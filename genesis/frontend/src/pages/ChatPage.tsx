import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  StreamTransportError,
  api,
  errorMessage,
  onReconnect,
  streamChat,
  type ChatResponse,
  type EmotionState,
  type ProactiveMessage,
} from "../api";
import { ConversationList } from "../components/chat/ConversationList";
import { EmotionStrip } from "../components/chat/EmotionStrip";
import { MessageBubble, type UiMessage } from "../components/chat/MessageBubble";
import { ProactiveCards } from "../components/chat/ProactiveCards";
import { Icon } from "../components/Icon";
import { ErrorState, Loading, Spinner, Toast } from "../components/ui";
import { useApi } from "../hooks/useApi";
import {
  Recorder,
  SentenceSplitter,
  SpeechQueue,
  browserRecognitionAvailable,
  browserTtsAvailable,
  extensionFor,
  getMicrophone,
  listenForUtterance,
  recognizeOnce,
  recordingSupported,
  startBrowserDictation,
  stopStream,
} from "../lib/voice";

// ---- Session-level state that survives navigating between pages ----
let greetingState: "idle" | "pending" | "done" | "failed" = "idle";
let lastConversationId: number | null = null;
/** ChatResponse details keyed by message id, so "memories used" survives reloading a conversation. */
const metaCache = new Map<number, ChatResponse>();

const SPEAK_KEY = "genesis.speakReplies";
function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function saveBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let keySeq = 0;
const newKey = (p: string) => `${p}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

type VoicePhase = "idle" | "listening" | "hearing" | "transcribing" | "thinking" | "speaking";
type SttMode = "server" | "browser";

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "",
  listening: "Listening…",
  hearing: "Hearing you…",
  transcribing: "Transcribing…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();
  const routeId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

  const conversations = useApi((s) => api.conversations(s), []);
  const proactive = useApi((s) => api.proactive(s), [], { refreshMs: 60000 });
  const reloadConversations = conversations.reload;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [greetingPhase, setGreetingPhase] = useState(greetingState);
  const [greetingError, setGreetingError] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<{ current?: EmotionState; mood?: string }>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "info" | "error" } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Voice
  const [speakReplies, setSpeakReplies] = useState(() => loadBool(SPEAK_KEY, false));
  const [continuous, setContinuous] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sttMode, setSttMode] = useState<SttMode>("server");
  const [ttsMode, setTtsMode] = useState<"server" | "browser">("server");

  const conversationIdRef = useRef<number | null>(routeId);
  const loadedForRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const speakRef = useRef(speakReplies);
  const continuousRef = useRef(false);
  const sttModeRef = useRef<SttMode>("server");
  const queueRef = useRef<SpeechQueue | null>(null);
  const loopAbortRef = useRef<AbortController | null>(null);
  const listenAbortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const dictationRef = useRef<ReturnType<typeof startBrowserDictation> | null>(null);
  const pressRef = useRef<{ t: number; started: boolean } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const levelRef = useRef<HTMLSpanElement>(null);

  speakRef.current = speakReplies;
  sttModeRef.current = sttMode;

  if (!queueRef.current) queueRef.current = new SpeechQueue();
  const queue = queueRef.current;

  useEffect(() => {
    mountedRef.current = true;
    queue.onSpeakingChange = (s) => mountedRef.current && setSpeaking(s);
    queue.onModeChange = (m) => mountedRef.current && setTtsMode(m);
    return () => {
      mountedRef.current = false;
      queue.stop();
      loopAbortRef.current?.abort();
      recorderRef.current?.cancel();
      dictationRef.current?.cancel();
    };
  }, [queue]);

  // Initial emotion state and voice capabilities.
  useEffect(() => {
    const c = new AbortController();
    api
      .emotions(c.signal)
      .then((e) => setEmotion((prev) => (prev.current ? prev : { current: e.current, mood: e.mood })))
      .catch(() => undefined);
    api
      .voiceStatus(c.signal)
      .then((v) => {
        if (!v.stt?.available && browserRecognitionAvailable()) setSttMode("browser");
        if (!v.tts?.available) queue.setMode("browser");
      })
      .catch(() => undefined);
    return () => c.abort();
  }, [queue]);

  const updateMessage = useCallback((key: string, patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) => {
    setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)));
  }, []);

  const adoptConversation = useCallback(
    (cid: number) => {
      lastConversationId = cid;
      if (conversationIdRef.current === cid) return;
      conversationIdRef.current = cid;
      loadedForRef.current = cid;
      if (mountedRef.current) navigate(`/chat/${cid}`, { replace: true });
    },
    [navigate],
  );

  // ---- Greeting on first open ----
  const greet = useCallback(async () => {
    greetingState = "pending";
    setGreetingPhase("pending");
    setGreetingError(null);
    try {
      const g = await api.greeting();
      greetingState = "done";
      if (!mountedRef.current) return;
      setGreetingPhase("done");
      loadedForRef.current = g.conversation_id;
      setMessages([
        { key: newKey("g"), id: g.message_id, role: "assistant", content: g.reply, kind: "greeting", created_at: new Date().toISOString() },
      ]);
      adoptConversation(g.conversation_id);
      reloadConversations();
      if (speakRef.current) queue.enqueue(g.reply);
    } catch (err) {
      greetingState = "failed";
      if (!mountedRef.current) return;
      setGreetingPhase("failed");
      setGreetingError(errorMessage(err));
    }
  }, [adoptConversation, reloadConversations, queue]);

  // Route handling: /chat with no id greets once per session, or returns to the last conversation.
  useEffect(() => {
    conversationIdRef.current = routeId;
    if (routeId !== null) {
      lastConversationId = routeId;
      return;
    }
    if (greetingState === "idle" || greetingState === "failed") {
      void greet();
    } else if (greetingState === "done" && lastConversationId !== null) {
      // "Chat" in the nav returns to the conversation you were in.
      navigate(`/chat/${lastConversationId}`, { replace: true });
    }
  }, [routeId, greet, navigate]);

  // If the greeting failed because the backend was offline, try again when it comes back.
  useEffect(
    () =>
      onReconnect(() => {
        if (greetingState === "failed" && conversationIdRef.current === null) void greet();
      }),
    [greet],
  );

  // ---- Load a conversation ----
  const loadConversation = useCallback(async (id: number, signal?: AbortSignal) => {
    setLoadingConv(true);
    setConvError(null);
    try {
      const conv = await api.conversation(id, signal);
      if (signal?.aborted) return;
      loadedForRef.current = id;
      stickToBottom.current = true;
      setMessages(
        conv.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            key: `m-${m.id}`,
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
            meta: metaCache.get(m.id),
          })),
      );
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof ApiError && err.status === 404) {
        if (lastConversationId === id) lastConversationId = null;
        setConvError("That conversation no longer exists.");
      } else setConvError(errorMessage(err));
    } finally {
      if (!signal?.aborted) setLoadingConv(false);
    }
  }, []);

  useEffect(() => {
    if (routeId === null || loadedForRef.current === routeId) return;
    const c = new AbortController();
    setMessages([]);
    void loadConversation(routeId, c.signal);
    return () => c.abort();
  }, [routeId, loadConversation]);

  // ---- Scrolling ----
  const onLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ---- Sending ----
  const sendMessage = useCallback(
    async (raw: string, opts: { forceSpeak?: boolean } = {}): Promise<ChatResponse | null> => {
      const message = raw.trim();
      if (!message || busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      // A typed message interrupts continuous listening for this turn.
      listenAbortRef.current?.abort();
      queue.stop();
      stickToBottom.current = true;

      const userKey = newKey("u");
      const aKey = newKey("a");
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { key: userKey, role: "user", content: message, created_at: now, pending: true },
        { key: aKey, role: "assistant", content: "", streaming: true },
      ]);

      const speak = opts.forceSpeak || speakRef.current || continuousRef.current;
      const splitter = new SentenceSplitter();
      const say = (sentences: string[]) => {
        if (!speak || !mountedRef.current) return;
        sentences.forEach((s) => queue.enqueue(s));
      };
      const cid = conversationIdRef.current ?? undefined;
      let streamedAny = false;

      try {
        let resp: ChatResponse;
        try {
          resp = await streamChat(
            { message, conversation_id: cid },
            {
              onMeta: (m) => {
                if (typeof m.conversation_id === "number") adoptConversation(m.conversation_id);
              },
              onToken: (t) => {
                streamedAny = true;
                updateMessage(aKey, (m) => ({ content: m.content + t }));
                say(splitter.push(t));
              },
            },
          );
        } catch (err) {
          if (err instanceof StreamTransportError && !err.receivedTokens) {
            // Streaming isn't available: fall back to the plain endpoint.
            resp = await api.chat({ message, conversation_id: cid });
          } else throw err;
        }

        metaCache.set(resp.message_id, resp);
        updateMessage(aKey, { content: resp.reply, streaming: false, id: resp.message_id, meta: resp, created_at: new Date().toISOString() });
        updateMessage(userKey, { pending: false });
        if (resp.emotion) setEmotion({ current: resp.emotion, mood: resp.mood });
        adoptConversation(resp.conversation_id);
        if (streamedAny) say(splitter.flush());
        else {
          splitter.reset();
          say([...splitter.push(resp.reply), ...splitter.flush()]);
        }
        reloadConversations();
        return resp;
      } catch (err) {
        const detail = errorMessage(err);
        updateMessage(aKey, (m) => ({
          streaming: false,
          error: m.content ? `The reply was interrupted: ${detail}` : `Couldn't get a reply: ${detail}`,
          retryText: m.content ? undefined : message,
        }));
        updateMessage(userKey, { pending: false });
        return null;
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    },
    [adoptConversation, reloadConversations, queue, updateMessage],
  );

  const retry = useCallback(
    (retryText: string) => {
      // Remove the failed exchange, then send again.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.retryText === retryText && m.error);
        if (idx < 1) return prev;
        return [...prev.slice(0, idx - 1), ...prev.slice(idx + 1)];
      });
      void sendMessage(retryText);
    },
    [sendMessage],
  );

  const submit = () => {
    if (!text.trim() || busy) return;
    const t = text;
    setText("");
    void sendMessage(t);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // Auto-size the composer.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // ---- Conversations ----
  const newConversation = () => {
    queue.stop();
    lastConversationId = null;
    loadedForRef.current = null;
    conversationIdRef.current = null;
    setMessages([]);
    setConvError(null);
    setDrawerOpen(false);
    navigate("/chat");
    inputRef.current?.focus();
  };

  const selectConversation = (id: number) => {
    setDrawerOpen(false);
    if (id !== routeId) {
      queue.stop();
      navigate(`/chat/${id}`);
    }
  };

  const deleteConversation = async (id: number) => {
    try {
      await api.deleteConversation(id);
      conversations.setData((prev) => (prev ?? []).filter((c) => c.id !== id));
      if (id === routeId || id === conversationIdRef.current) newConversation();
      if (lastConversationId === id) lastConversationId = null;
    } catch (err) {
      setToast({ msg: `Couldn't delete: ${errorMessage(err)}`, tone: "error" });
    }
  };

  // ---- Proactive ----
  const dismissProactive = async (id: number) => {
    proactive.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
    try {
      await api.dismissProactive(id);
    } catch (err) {
      setToast({ msg: `Couldn't dismiss: ${errorMessage(err)}`, tone: "error" });
      proactive.reload();
    }
  };
  const replyToProactive = (p: ProactiveMessage) => {
    setMessages((prev) => [...prev, { key: newKey("p"), role: "assistant", content: p.content, kind: "proactive", created_at: p.created_at }]);
    void dismissProactive(p.id);
    inputRef.current?.focus();
  };

  // ---- Voice: transcription helper ----
  const transcribeBlob = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      const r = await api.transcribe(blob, `speech.${extensionFor(blob.type)}`);
      return (r.text ?? "").trim();
    } catch (err) {
      if (browserRecognitionAvailable()) {
        setSttMode("browser");
        sttModeRef.current = "browser";
        setToast({
          msg: "Server transcription isn't available, so the mic now uses your browser's speech recognition. Please say that again.",
          tone: "info",
        });
      } else {
        setToast({ msg: `Couldn't transcribe: ${errorMessage(err)}`, tone: "error" });
      }
      return null;
    }
  }, []);

  // ---- Push to talk ----
  const startRecording = async () => {
    if (recording || busy) return;
    queue.stop();
    try {
      if (sttModeRef.current === "browser") {
        dictationRef.current = startBrowserDictation();
      } else {
        const rec = new Recorder();
        await rec.start();
        recorderRef.current = rec;
      }
      setRecording(true);
    } catch (err) {
      pressRef.current = null;
      setToast({ msg: errorMessage(err), tone: "error" });
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    let transcript: string | null = null;
    setTranscribing(true);
    try {
      if (dictationRef.current) {
        const d = dictationRef.current;
        dictationRef.current = null;
        transcript = await d.stop();
      } else if (recorderRef.current) {
        const rec = recorderRef.current;
        recorderRef.current = null;
        const blob = await rec.stop();
        if (blob.size < 1200) {
          setToast({ msg: "That was too short to hear. Hold the mic a little longer.", tone: "info" });
          return;
        }
        transcript = await transcribeBlob(blob);
      }
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
    if (transcript) void sendMessage(transcript);
    else if (transcript === "") setToast({ msg: "I didn't catch anything. Try again?", tone: "info" });
  };

  const micPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!recording) {
      pressRef.current = { t: performance.now(), started: true };
      void startRecording();
    } else pressRef.current = { t: performance.now(), started: false };
  };
  const micPointerUp = () => {
    const p = pressRef.current;
    // Held down: release sends. A quick tap leaves it recording (tap again to send).
    if (p?.started && performance.now() - p.t > 400 && recording) {
      pressRef.current = { t: 0, started: true };
      void stopRecording();
    }
  };
  const micClick = () => {
    const p = pressRef.current;
    pressRef.current = null;
    if (p) {
      if (!p.started && recording) void stopRecording();
      return;
    }
    // Keyboard activation toggles.
    if (recording) void stopRecording();
    else void startRecording();
  };

  // ---- Continuous conversation ----
  const runContinuous = useCallback(
    async (signal: AbortSignal) => {
      let stream: MediaStream | null = null;
      let ctx: AudioContext | null = null;
      const setLevel = (l: number) => levelRef.current?.style.setProperty("--level", l.toFixed(3));
      try {
        if (sttModeRef.current === "server") {
          stream = await getMicrophone();
          ctx = new AudioContext();
        }
        while (!signal.aborted) {
          // Never listen while a reply is being generated or spoken.
          while ((busyRef.current || queue.speaking) && !signal.aborted) {
            if (queue.speaking) setPhase("speaking");
            await (queue.speaking ? queue.waitIdle() : new Promise((r) => window.setTimeout(r, 200)));
          }
          if (signal.aborted) break;

          const listen = new AbortController();
          listenAbortRef.current = listen;
          const onOuterAbort = () => listen.abort();
          signal.addEventListener("abort", onOuterAbort, { once: true });
          setPhase("listening");
          let transcript: string | null = null;
          try {
            if (sttModeRef.current === "server") {
              if (!stream || !ctx) {
                stream = await getMicrophone();
                ctx = new AudioContext();
              }
              if (ctx.state === "suspended") await ctx.resume();
              const blob = await listenForUtterance(stream, ctx, {
                signal: listen.signal,
                silenceMs: 1200,
                onSpeechStart: () => setPhase("hearing"),
                onLevel: setLevel,
              });
              if (!blob) continue; // interrupted (typed message) or stopped
              if (blob.size < 1500) continue;
              setPhase("transcribing");
              transcript = await transcribeBlob(blob);
            } else {
              transcript = await recognizeOnce({ signal: listen.signal, onSpeechStart: () => setPhase("hearing") });
            }
          } finally {
            signal.removeEventListener("abort", onOuterAbort);
            listenAbortRef.current = null;
          }
          if (signal.aborted) break;
          if (!transcript) {
            if (transcript === null && !browserRecognitionAvailable()) break; // transcription is broken; stop the loop
            continue;
          }
          setPhase("thinking");
          const resp = await sendMessage(transcript, { forceSpeak: true });
          if (signal.aborted) break;
          if (queue.speaking) {
            setPhase("speaking");
            await queue.waitIdle();
          }
          if (!resp) await new Promise((r) => window.setTimeout(r, 1500));
        }
      } catch (err) {
        if (mountedRef.current) setToast({ msg: errorMessage(err), tone: "error" });
      } finally {
        stopStream(stream);
        void ctx?.close().catch(() => undefined);
        setLevel(0);
        if (mountedRef.current) {
          setPhase("idle");
          setContinuous(false);
        }
        continuousRef.current = false;
      }
    },
    [queue, sendMessage, transcribeBlob],
  );

  const toggleContinuous = () => {
    if (continuousRef.current) {
      loopAbortRef.current?.abort();
      loopAbortRef.current = null;
      queue.stop();
      continuousRef.current = false;
      setContinuous(false);
      setPhase("idle");
      return;
    }
    if (sttModeRef.current === "server" && !recordingSupported()) {
      setToast({ msg: "This browser can't record audio.", tone: "error" });
      return;
    }
    const c = new AbortController();
    loopAbortRef.current = c;
    continuousRef.current = true;
    setContinuous(true);
    void runContinuous(c.signal);
  };

  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    saveBool(SPEAK_KEY, next);
    if (!next && !continuousRef.current) queue.stop();
  };

  // ---- Images ----
  const onImagePicked = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ msg: "Please choose an image file.", tone: "error" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setToast({ msg: "That image is larger than 20 MB.", tone: "error" });
      return;
    }
    const prompt = text.trim();
    setText("");
    const url = URL.createObjectURL(file);
    const uKey = newKey("iu");
    const aKey = newKey("ia");
    stickToBottom.current = true;
    setMessages((prev) => [
      ...prev,
      { key: uKey, role: "user", content: prompt, imageUrl: url, created_at: new Date().toISOString() },
      { key: aKey, role: "assistant", content: "", streaming: true, kind: "vision" },
    ]);
    try {
      const r = await api.analyzeImage(file, prompt, true);
      updateMessage(aKey, { content: r.description, streaming: false, visionModel: r.model, created_at: new Date().toISOString() });
      if (speakRef.current) queue.enqueue(r.description);
    } catch (err) {
      updateMessage(aKey, { streaming: false, error: `Couldn't analyse the image: ${errorMessage(err)}` });
    }
  };

  // ---- Derived UI ----
  const voiceLabel = continuous ? PHASE_LABEL[phase] || "Starting…" : recording ? "Recording… release or tap to send" : transcribing ? "Transcribing…" : speaking ? "Speaking…" : "";
  const statusPhase: VoicePhase | "recording" = continuous ? phase : recording ? "recording" as const : transcribing ? "transcribing" : speaking ? "speaking" : "idle";
  const activeTitle = useMemo(
    () => conversations.data?.find((c) => c.id === routeId)?.title,
    [conversations.data, routeId],
  );
  const showGreetingPending = routeId === null && greetingPhase === "pending" && messages.length === 0;
  const showGreetingFailed = routeId === null && greetingPhase === "failed" && messages.length === 0;
  const micSupported = recordingSupported() || browserRecognitionAvailable();

  return (
    <div className="chat">
      <aside className={drawerOpen ? "chat-sidebar open" : "chat-sidebar"} aria-label="Conversations">
        <ConversationList
          conversations={conversations.data}
          loading={conversations.loading}
          error={conversations.error}
          activeId={routeId}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={(id) => void deleteConversation(id)}
          onRetry={conversations.reload}
        />
      </aside>
      {drawerOpen && <button type="button" className="scrim" aria-label="Close conversations" onClick={() => setDrawerOpen(false)} />}

      <section className="chat-main" aria-label="Chat">
        <header className="chat-head">
          <button
            type="button"
            className="icon-btn chat-drawer-btn"
            aria-label="Show conversations"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            <Icon name="menu" />
          </button>
          <div className="chat-title">
            <h1>{activeTitle || (routeId ? `Conversation ${routeId}` : "New conversation")}</h1>
            <EmotionStrip emotion={emotion.current} mood={emotion.mood} />
          </div>
          <div className="chat-toggles">
            <button
              type="button"
              className={speakReplies ? "toggle-btn on" : "toggle-btn"}
              aria-pressed={speakReplies}
              onClick={toggleSpeak}
              title={ttsMode === "browser" ? "Speak replies (browser voice)" : "Speak replies"}
            >
              <Icon name={speakReplies ? "volume" : "volumeOff"} />
              <span className="toggle-btn-label">Speak replies</span>
            </button>
            <button
              type="button"
              className={continuous ? "toggle-btn on" : "toggle-btn"}
              aria-pressed={continuous}
              onClick={toggleContinuous}
              disabled={!micSupported}
              title="Hands-free: listen, reply, speak, and listen again"
            >
              <Icon name="loop" />
              <span className="toggle-btn-label">Continuous</span>
            </button>
          </div>
        </header>

        <div
          className="chat-log"
          ref={logRef}
          onScroll={onLogScroll}
          role="log"
          aria-live="polite"
          aria-busy={busy}
          aria-label="Messages"
          tabIndex={0}
        >
          <div className="chat-log-inner">
            {proactive.data && proactive.data.length > 0 && (
              <ProactiveCards items={proactive.data} onDismiss={(id) => void dismissProactive(id)} onReply={replyToProactive} />
            )}
            {showGreetingPending && (
              <div className="greeting-pending">
                <span className="orb orb-thinking" aria-hidden="true" />
                <p className="muted">Genesis is waking up…</p>
              </div>
            )}
            {showGreetingFailed && (
              <ErrorState error={`Genesis couldn't say hello (${greetingError}).`} onRetry={() => void greet()} />
            )}
            {loadingConv && messages.length === 0 && <Loading rows={4} label="Loading conversation" />}
            {convError && (
              <ErrorState error={convError} onRetry={routeId ? () => void loadConversation(routeId) : undefined} />
            )}
            {!loadingConv && !convError && messages.length === 0 && !showGreetingPending && !showGreetingFailed && (
              <div className="chat-empty">
                <span className="orb" aria-hidden="true" />
                <p>What's on your mind?</p>
                <p className="muted">Type, hold the mic to talk, or turn on continuous mode for a hands-free chat.</p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.key} msg={m} onRetry={retry} />
            ))}
          </div>
        </div>

        {statusPhase !== "idle" && (
          <div className={`voice-status voice-${statusPhase}`} role="status">
            <span className="voice-orb" ref={levelRef} aria-hidden="true" />
            <span>{voiceLabel}</span>
            {(speaking || continuous) && (
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => (continuous ? toggleContinuous() : queue.stop())}
              >
                <Icon name="stop" size={13} /> {continuous ? "End hands-free" : "Stop speaking"}
              </button>
            )}
          </div>
        )}

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onImagePicked(e.target.files?.[0])}
          />
          <button
            type="button"
            className="icon-btn composer-btn"
            aria-label="Attach an image for Genesis to look at"
            title="Attach image (uses the typed text as the question)"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Icon name="image" size={20} />
          </button>
          <label htmlFor="composer-input" className="sr-only">
            Message
          </label>
          <textarea
            id="composer-input"
            ref={inputRef}
            rows={1}
            value={text}
            placeholder={continuous ? "Hands-free mode is on. You can still type." : "Message Genesis…"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className={recording ? "icon-btn composer-btn mic recording" : "icon-btn composer-btn mic"}
            aria-label={recording ? "Stop recording and send" : "Hold to talk (or press to start recording)"}
            aria-pressed={recording}
            title={sttMode === "browser" ? "Talk (browser speech recognition)" : "Hold to talk, or tap to start and tap again to send"}
            onPointerDown={micPointerDown}
            onPointerUp={micPointerUp}
            onClick={micClick}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!micSupported || continuous || transcribing || (busy && !recording)}
          >
            {transcribing ? <Spinner size={18} label="Transcribing" /> : <Icon name="mic" size={20} />}
          </button>
          <button type="submit" className="btn btn-primary composer-send" disabled={busy || !text.trim()} aria-label="Send message">
            {busy ? <Spinner size={16} label="Waiting for reply" /> : <Icon name="send" size={18} />}
          </button>
        </form>
        {!browserTtsAvailable() && ttsMode === "browser" && speakReplies && (
          <p className="hint composer-hint">Server voice is unavailable and this browser can't speak, so replies won't be read aloud.</p>
        )}
      </section>
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}

export default ChatPage;
