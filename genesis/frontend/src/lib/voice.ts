// Voice helpers: recording, silence detection, sentence-level speech queue,
// and browser fallbacks (speechSynthesis / SpeechRecognition).

import { ApiError, api } from "../api";

// ---------------------------------------------------------------------------
// Text preparation
// ---------------------------------------------------------------------------

/** Strip markdown-ish syntax so it isn't read aloud. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits streamed text into speakable sentences as tokens arrive, so the first
 * sentence can be synthesised while the rest of the reply is still generating.
 */
export class SentenceSplitter {
  private buffer = "";
  private readonly minLength: number;

  constructor(minLength = 24) {
    this.minLength = minLength;
  }

  push(text: string): string[] {
    this.buffer += text;
    const out: string[] = [];
    // A boundary is terminal punctuation (plus closing quotes/brackets) followed by whitespace, or a newline.
    const re = /([.!?…]+["'”’)\]]*)(\s+)|\n+/g;
    let start = 0;
    let match: RegExpExecArray | null;
    let pending = "";
    while ((match = re.exec(this.buffer)) !== null) {
      const end = match.index + match[0].length;
      const piece = this.buffer.slice(start, end);
      start = end;
      pending += piece;
      if (cleanForSpeech(pending).length >= this.minLength) {
        out.push(cleanForSpeech(pending));
        pending = "";
      }
    }
    this.buffer = pending + this.buffer.slice(start);
    return out;
  }

  flush(): string[] {
    const rest = cleanForSpeech(this.buffer);
    this.buffer = "";
    return rest ? [rest] : [];
  }

  reset() {
    this.buffer = "";
  }
}

// ---------------------------------------------------------------------------
// Speech output queue
// ---------------------------------------------------------------------------

interface QueueItem {
  text: string;
  audio: Promise<Blob | null> | null; // null => speak with the browser
}

export type TtsMode = "server" | "browser";

/**
 * Plays sentences in order. Each sentence's WAV is requested from POST /voice/speak as soon
 * as it is queued (so synthesis overlaps playback). A 503 (Piper not installed) or repeated
 * failures switch to window.speechSynthesis for the rest of the session.
 */
export class SpeechQueue {
  private items: QueueItem[] = [];
  private playing = false;
  private generation = 0;
  private failures = 0;
  private controller = new AbortController();
  private currentAudio: HTMLAudioElement | null = null;
  private idleWaiters: (() => void)[] = [];
  mode: TtsMode = "server";
  onSpeakingChange?: (speaking: boolean) => void;
  onModeChange?: (mode: TtsMode) => void;

  get speaking(): boolean {
    return this.playing || this.items.length > 0;
  }

  setMode(mode: TtsMode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.onModeChange?.(mode);
    }
  }

  enqueue(raw: string) {
    const text = cleanForSpeech(raw);
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
    const item: QueueItem = { text, audio: this.mode === "server" ? this.fetchAudio(text) : null };
    this.items.push(item);
    if (!this.playing) void this.pump();
  }

  /** Resolves once everything queued so far has been spoken (or the queue was stopped). */
  waitIdle(): Promise<void> {
    if (!this.speaking) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  stop() {
    this.generation++;
    this.items = [];
    this.controller.abort();
    this.controller = new AbortController();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.setPlaying(false);
  }

  private setPlaying(p: boolean) {
    if (this.playing === p && p) return;
    this.playing = p;
    this.onSpeakingChange?.(p);
    if (!p) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((w) => w());
    }
  }

  private async fetchAudio(text: string): Promise<Blob | null> {
    try {
      const blob = await api.speak(text, this.controller.signal);
      this.failures = 0;
      return blob.size > 44 ? blob : null;
    } catch (err) {
      if (err instanceof ApiError && err.aborted) return null;
      this.failures++;
      if ((err instanceof ApiError && err.status === 503) || this.failures >= 2) this.setMode("browser");
      return null;
    }
  }

  private async pump() {
    const gen = this.generation;
    this.setPlaying(true);
    while (this.items.length > 0) {
      const item = this.items.shift()!;
      const blob = item.audio ? await item.audio : null;
      if (gen !== this.generation) return;
      if (blob) {
        const ok = await this.playBlob(blob, gen);
        if (!ok && gen === this.generation) await speakWithBrowser(item.text);
      } else {
        await speakWithBrowser(item.text);
      }
      if (gen !== this.generation) return;
    }
    this.setPlaying(false);
  }

  private playBlob(blob: Blob, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;
      const done = (ok: boolean) => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
        resolve(ok);
      };
      audio.onended = () => done(true);
      audio.onpause = () => {
        if (gen !== this.generation) done(true);
      };
      audio.onerror = () => done(false);
      audio.play().catch(() => done(false));
    });
  }
}

export function browserTtsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speakWithBrowser(text: string): Promise<void> {
  if (!browserTtsAvailable()) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const lang = navigator.language || "en-US";
    const preferred =
      voices.find((v) => v.lang === lang && /natural|neural|premium|enhanced/i.test(v.name)) ??
      voices.find((v) => v.lang === lang && v.localService) ??
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (preferred) u.voice = preferred;
    // Some engines never fire `end`; don't let the queue hang.
    const safety = window.setTimeout(finish, 4000 + text.length * 110);
    function finish() {
      window.clearTimeout(safety);
      resolve();
    }
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function extensionFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function recordingSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export async function getMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't access a microphone.");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error("Microphone permission was denied.");
    if (name === "NotFoundError") throw new Error("No microphone was found.");
    throw new Error(`Couldn't open the microphone (${err instanceof Error ? err.message : String(err)}).`);
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Press-to-talk recorder. */
export class Recorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  mimeType = "";

  async start() {
    this.stream = await getMicrophone();
    this.mimeType = pickMimeType();
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    const rec = this.recorder;
    const stream = this.stream;
    this.recorder = null;
    this.stream = null;
    return new Promise((resolve) => {
      if (!rec || rec.state === "inactive") {
        stopStream(stream);
        resolve(new Blob(this.chunks, { type: this.mimeType || "audio/webm" }));
        return;
      }
      rec.onstop = () => {
        stopStream(stream);
        resolve(new Blob(this.chunks, { type: rec.mimeType || this.mimeType || "audio/webm" }));
      };
      rec.stop();
    });
  }

  cancel() {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    stopStream(this.stream);
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
  }
}

// ---------------------------------------------------------------------------
// Silence detection (continuous conversation)
// ---------------------------------------------------------------------------

export interface ListenOptions {
  signal: AbortSignal;
  /** Silence after speech that ends the utterance. */
  silenceMs?: number;
  /** Hard cap on one utterance. */
  maxUtteranceMs?: number;
  onSpeechStart?: () => void;
  /** 0..1 input level, for a visual meter. */
  onLevel?: (level: number) => void;
}

/**
 * Records from `stream` until the user has spoken and then been silent for `silenceMs`.
 * Uses a WebAudio analyser (RMS) with an adaptive noise floor. Resolves with the audio,
 * or null if aborted.
 */
export function listenForUtterance(stream: MediaStream, ctx: AudioContext, opts: ListenOptions): Promise<Blob | null> {
  const silenceMs = opts.silenceMs ?? 1200;
  const maxMs = opts.maxUtteranceMs ?? 30000;
  const idleRestartMs = 15000;
  const frameMs = 50;

  return new Promise((resolve, reject) => {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const mimeType = pickMimeType();

    let recorder: MediaRecorder;
    let chunks: Blob[] = [];
    let recStart = 0;
    const startRecorder = () => {
      chunks = [];
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(200);
      recStart = performance.now();
    };

    let noise = 0.01;
    let aboveFrames = 0;
    let speechStart = 0;
    let lastVoice = 0;
    let finished = false;

    const cleanup = () => {
      finished = true;
      window.clearInterval(timer);
      opts.signal.removeEventListener("abort", onAbort);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      opts.onLevel?.(0);
    };

    const finish = () => {
      if (finished) return;
      cleanup();
      const rec = recorder;
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
      if (rec.state !== "inactive") rec.stop();
      else resolve(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
    };

    const onAbort = () => {
      if (finished) return;
      cleanup();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      resolve(null);
    };

    try {
      startRecorder();
    } catch (err) {
      reject(err);
      return;
    }
    opts.signal.addEventListener("abort", onAbort, { once: true });

    const timer = window.setInterval(() => {
      if (finished) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      opts.onLevel?.(Math.min(1, rms * 12));
      const threshold = Math.max(0.012, noise * 3);
      const now = performance.now();

      if (!speechStart) {
        // Track the background noise floor slowly while nobody is talking.
        noise = noise * 0.95 + Math.min(rms, 0.05) * 0.05;
        if (rms > threshold) {
          aboveFrames++;
          if (aboveFrames >= 3) {
            speechStart = now;
            lastVoice = now;
            opts.onSpeechStart?.();
          }
        } else {
          aboveFrames = 0;
          if (now - recStart > idleRestartMs) {
            // Nobody spoke for a while: drop the buffered silence and start fresh.
            recorder.ondataavailable = null;
            if (recorder.state !== "inactive") recorder.stop();
            startRecorder();
          }
        }
        return;
      }

      if (rms > threshold * 0.8) lastVoice = now;
      if (now - lastVoice >= silenceMs || now - speechStart >= maxMs) finish();
    }, frameMs);
  });
}

// ---------------------------------------------------------------------------
// Browser speech recognition fallback
// ---------------------------------------------------------------------------

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserRecognitionAvailable(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * One utterance via the browser's SpeechRecognition (used only when server-side
 * transcription is unavailable). Resolves with "" on silence or abort.
 */
export function recognizeOnce(opts: { signal?: AbortSignal; onSpeechStart?: () => void } = {}): Promise<string> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return Promise.reject(new Error("Speech recognition isn't available in this browser."));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let transcript = "";
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      settle(() => resolve(""));
    };
    rec.onspeechstart = () => opts.onSpeechStart?.();
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") settle(() => resolve(""));
      else settle(() => reject(new Error(`Speech recognition error: ${e.error}`)));
    };
    rec.onend = () => settle(() => resolve(transcript.trim()));
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      rec.start();
    } catch (err) {
      settle(() => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}

/** Browser recognition that runs until stop() is called (press-to-talk fallback). */
export function startBrowserDictation(): { stop: () => Promise<string>; cancel: () => void } {
  const Ctor = getRecognitionCtor();
  if (!Ctor) throw new Error("Speech recognition isn't available in this browser.");
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.continuous = true;
  rec.interimResults = false;
  let transcript = "";
  let ended = false;
  let endResolve: (() => void) | null = null;
  rec.onresult = (e) => {
    transcript = "";
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) transcript += `${e.results[i][0].transcript} `;
    }
  };
  rec.onerror = () => undefined;
  rec.onend = () => {
    ended = true;
    endResolve?.();
  };
  rec.start();
  return {
    stop: () =>
      new Promise<string>((resolve) => {
        const done = () => resolve(transcript.trim());
        if (ended) return done();
        endResolve = done;
        rec.stop();
        window.setTimeout(done, 2500);
      }),
    cancel: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
