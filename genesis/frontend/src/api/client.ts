// Typed client for the Genesis HTTP API (genesis/docs/API.md).

import { markOffline, markOnline, slowEnded, slowStarted } from "./connection";
import type {
  AutomationJob,
  AutomationRunResult,
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  DocumentUploadResult,
  EmotionsResponse,
  Goal,
  GoalDetail,
  GoalHorizon,
  GoalStatus,
  GoalType,
  GreetingResponse,
  Health,
  JournalEntry,
  JournalPeriod,
  KnowledgeGraph,
  KnowledgeItem,
  Memory,
  MemoryAddRequest,
  MemoryListQuery,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdateRequest,
  PersonalityProfile,
  PersonalityResponse,
  ProactiveMessage,
  Profile,
  Reflection,
  Relationship,
  Settings,
  Stats,
  TimelineCreate,
  TimelineEvent,
  ToolInfo,
  ToolLog,
  TranscribeResult,
  VisionResult,
  VoiceStatus,
} from "./types";

const TOKEN_KEY = "genesis.apiToken";
const DEFAULT_BASE = "http://127.0.0.1:8000/api";

export const API_BASE: string = (import.meta.env.VITE_GENESIS_API ?? DEFAULT_BASE).replace(/\/+$/, "");

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode); token just won't persist */
  }
}

/** The token saved on the Settings page wins over the build-time VITE_GENESIS_TOKEN. */
export function getToken(): string {
  return getStoredToken() || (import.meta.env.VITE_GENESIS_TOKEN ?? "");
}

export class ApiError extends Error {
  status: number;
  /** True when the backend could not be reached at all (network error / proxy 502/504). */
  offline: boolean;
  aborted: boolean;

  constructor(message: string, status = 0, opts: { offline?: boolean; aborted?: boolean } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.offline = !!opts.offline;
    this.aborted = !!opts.aborted;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof ApiError && err.aborted) ||
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Abort after this many ms. Defaults to 20s; pass 0 for no timeout (LLM-backed calls). */
  timeoutMs?: number;
  /** Show the "backend is slow" hint if this request takes longer than 6s. Defaults to true for fast calls. */
  trackSlow?: boolean;
  accept?: string;
}

const SLOW_MS = 6000;
const DEFAULT_TIMEOUT_MS = 20000;

export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  let url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "X-Genesis-Token": token } : {};
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `${res.status} ${res.statusText}`;
    try {
      const json = JSON.parse(text) as { detail?: unknown };
      const d = json.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) {
        return d
          .map((x) => (x && typeof x === "object" && "msg" in x ? String((x as { msg: unknown }).msg) : JSON.stringify(x)))
          .join("; ");
      }
      if (d) return JSON.stringify(d);
    } catch {
      /* not JSON */
    }
    return text.length > 300 ? `${res.status} ${res.statusText}` : text;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

/** Low-level fetch wrapper: auth header, timeout, offline tracking, error normalisation. */
export async function rawFetch(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = timeoutMs > 0 ? window.setTimeout(() => ((timedOut = true), controller.abort()), timeoutMs) : 0;
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  const trackSlow = opts.trackSlow ?? timeoutMs > 0;
  let slowFlagged = false;
  const slowTimer = trackSlow
    ? window.setTimeout(() => {
        slowFlagged = true;
        slowStarted();
      }, SLOW_MS)
    : 0;

  const headers: Record<string, string> = { ...authHeaders() };
  if (opts.accept) headers.Accept = opts.accept;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  try {
    const res = await fetch(buildUrl(path, opts.query), { method, headers, body, signal: controller.signal });
    if (res.status === 502 || res.status === 504) {
      // A proxy (Vite dev server or nginx) answered, but the backend behind it did not.
      markOffline(`Proxy returned ${res.status}`);
      throw new ApiError("Genesis backend is not responding.", res.status, { offline: true });
    }
    markOnline();
    if (!res.ok) {
      throw new ApiError(await parseErrorDetail(res), res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.aborted) {
      if (timedOut) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`, 0, { offline: false });
      }
      throw new ApiError("Request cancelled.", 0, { aborted: true });
    }
    const reason = err instanceof Error ? err.message : String(err);
    markOffline(reason);
    throw new ApiError(`Can't reach Genesis (${reason}).`, 0, { offline: true });
  } finally {
    if (timer) window.clearTimeout(timer);
    if (slowTimer) window.clearTimeout(slowTimer);
    if (slowFlagged) slowEnded();
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(method, path, { accept: "application/json", ...opts });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("The backend returned an unexpected (non-JSON) response.", res.status);
  }
}

const get = <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts);
const post = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, { ...opts, body: body ?? {} });
const put = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, { ...opts, body: body ?? {} });
const del = <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts);

/** LLM-backed calls can legitimately take a long time: no timeout, no "slow" banner. */
const LLM: RequestOptions = { timeoutMs: 0, trackSlow: false };

// ---------------------------------------------------------------------------
// Chat streaming (SSE over POST)
// ---------------------------------------------------------------------------

export interface StreamHandlers {
  onMeta?: (meta: { conversation_id: number }) => void;
  onToken?: (text: string) => void;
}

export class StreamTransportError extends Error {
  /** Whether any token reached the client before the failure. */
  receivedTokens: boolean;
  constructor(message: string, receivedTokens: boolean) {
    super(message);
    this.name = "StreamTransportError";
    this.receivedTokens = receivedTokens;
  }
}

/**
 * POST /chat/stream and parse the Server-Sent Events by hand (EventSource can't POST).
 * Resolves with the final ChatResponse from the `done` event.
 * - An `error` event rejects with ApiError (the backend reported a problem).
 * - Transport problems reject with StreamTransportError so the caller can fall back to POST /chat.
 */
export async function streamChat(body: ChatRequest, handlers: StreamHandlers, signal?: AbortSignal): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await rawFetch("POST", "/chat/stream", { body, signal, accept: "text/event-stream", ...LLM });
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 404 && err.status !== 405) {
      throw err; // validation / auth problems won't be fixed by the fallback
    }
    throw new StreamTransportError(errorMessage(err), false);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.body || !contentType.includes("text/event-stream")) {
    throw new StreamTransportError(`Unexpected stream response (${contentType || "no content type"}).`, false);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];
  let receivedTokens = false;
  let final: ChatResponse | null = null;
  let backendError: string | null = null;

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = "message";
      return;
    }
    const raw = dataLines.join("\n");
    const name = eventName;
    eventName = "message";
    dataLines = [];
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { text: raw };
    }
    const obj = (data ?? {}) as Record<string, unknown>;
    switch (name) {
      case "meta":
        handlers.onMeta?.(obj as { conversation_id: number });
        break;
      case "token":
        if (typeof obj.text === "string") {
          receivedTokens = true;
          handlers.onToken?.(obj.text);
        }
        break;
      case "done":
        final = obj as unknown as ChatResponse;
        break;
      case "error":
        backendError = typeof obj.detail === "string" ? obj.detail : JSON.stringify(obj.detail ?? obj);
        break;
      default:
        break;
    }
  };

  const processLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return; // comment / keep-alive
    const idx = line.indexOf(":");
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? "" : line.slice(idx + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r\n|\r|\n/)) !== -1) {
        const line = buffer.slice(0, nl);
        const sepLen = buffer[nl] === "\r" && buffer[nl + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(nl + sepLen);
        processLine(line);
      }
      if (final || backendError) break;
    }
    buffer += decoder.decode();
    if (buffer) processLine(buffer);
    dispatch();
  } catch (err) {
    if (signal?.aborted) throw new ApiError("Request cancelled.", 0, { aborted: true });
    throw new StreamTransportError(`Stream interrupted: ${errorMessage(err)}`, receivedTokens);
  } finally {
    reader.cancel().catch(() => undefined);
  }

  if (backendError) throw new ApiError(backendError, 500);
  if (!final) throw new StreamTransportError("The stream ended before the reply was complete.", receivedTokens);
  return final;
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

export const api = {
  // Health and stats
  health: (signal?: AbortSignal) => get<Health>("/health", { signal, timeoutMs: 8000 }),
  stats: (signal?: AbortSignal) => get<Stats>("/stats", { signal }),

  // Chat
  chat: (body: ChatRequest, signal?: AbortSignal) => post<ChatResponse>("/chat", body, { signal, ...LLM }),
  greeting: (signal?: AbortSignal) => post<GreetingResponse>("/chat/greeting", {}, { signal, ...LLM }),
  conversations: (signal?: AbortSignal) => get<ConversationSummary[]>("/conversations", { signal }),
  conversation: (id: number, signal?: AbortSignal) => get<ConversationDetail>(`/conversations/${id}`, { signal }),
  deleteConversation: (id: number) => del<{ deleted: true }>(`/conversations/${id}`),

  // Memory
  memories: (q: MemoryListQuery = {}, signal?: AbortSignal) =>
    get<Memory[]>("/memory", {
      signal,
      query: {
        memory_type: q.memory_type,
        importance: q.importance,
        include_archived: q.include_archived ? "true" : undefined,
        limit: q.limit ?? 50,
        offset: q.offset ?? 0,
      },
    }),
  memory: (id: number, signal?: AbortSignal) => get<Memory>(`/memory/${id}`, { signal }),
  addMemory: (body: MemoryAddRequest) => post<Memory>("/memory/add", body, { timeoutMs: 60000 }),
  searchMemories: (body: MemorySearchRequest, signal?: AbortSignal) =>
    post<MemorySearchResult[]>("/memory/search", body, { signal, timeoutMs: 60000 }),
  updateMemory: (body: MemoryUpdateRequest) => post<Memory>("/memory/update", body, { timeoutMs: 60000 }),
  deleteMemory: (memory_id: number) => post<{ deleted: true }>("/memory/delete", { memory_id }),

  // Profile
  profile: (signal?: AbortSignal) => get<Profile>("/profile", { signal }),
  updateProfile: (field: string, value: unknown) => put<Profile>("/profile", { field, value }),

  // Goals
  goals: (status?: string, signal?: AbortSignal) => get<Goal[]>("/goals", { signal, query: { status } }),
  goal: (id: number, signal?: AbortSignal) => get<GoalDetail>(`/goals/${id}`, { signal }),
  createGoal: (body: {
    title: string;
    description?: string;
    goal_type?: GoalType;
    horizon?: GoalHorizon;
    owner?: "user" | "companion";
    follow_up_interval_days?: number;
  }) => post<Goal>("/goals", body),
  updateGoal: (body: { goal_id: number; status?: GoalStatus; progress?: number; note?: string }) =>
    post<Goal>("/goals/update", body),

  // Emotion, personality, relationship
  emotions: (signal?: AbortSignal) => get<EmotionsResponse>("/emotions", { signal }),
  personality: (signal?: AbortSignal) => get<PersonalityResponse>("/personality", { signal }),
  updatePersonalityProfile: (profile: Partial<PersonalityProfile>) => put<PersonalityResponse>("/personality/profile", profile),
  relationship: (signal?: AbortSignal) => get<Relationship>("/relationship", { signal }),

  // Knowledge
  knowledge: (limit = 100, signal?: AbortSignal) => get<KnowledgeItem[]>("/knowledge", { signal, query: { limit } }),
  addKnowledge: (body: {
    statement: string;
    subject?: string;
    predicate?: string;
    object?: string;
    source?: string;
    confidence?: number;
  }) => post<KnowledgeItem>("/knowledge", body),
  knowledgeGraph: (signal?: AbortSignal) => get<KnowledgeGraph>("/knowledge/graph", { signal }),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentUploadResult>("POST", "/documents/upload", { form, ...LLM });
  },

  // Journal, timeline, reflections
  journal: (period?: JournalPeriod, signal?: AbortSignal) => get<JournalEntry[]>("/journal", { signal, query: { period } }),
  generateJournal: (period: JournalPeriod) => post<JournalEntry>("/journal/generate", { period }, LLM),
  timeline: (signal?: AbortSignal) => get<TimelineEvent[]>("/timeline", { signal }),
  addTimelineEvent: (body: TimelineCreate) => post<TimelineEvent>("/timeline", body),
  reflections: (signal?: AbortSignal) => get<Reflection[]>("/reflections", { signal }),
  runReflection: () => post<Reflection>("/reflections/run", {}, LLM),

  // Settings, tools, automation, proactive
  settings: (signal?: AbortSignal) => get<Settings>("/settings", { signal }),
  updateSettings: (patch: Settings) => put<Settings>("/settings", patch),
  tools: (signal?: AbortSignal) => get<ToolInfo[]>("/tools", { signal }),
  executeTool: (name: string, args: Record<string, unknown>) =>
    post<{ ok: boolean; result: unknown }>("/tools/execute", { name, arguments: args }, LLM),
  toolLogs: (signal?: AbortSignal) => get<ToolLog[]>("/tools/logs", { signal }),
  automationJobs: (signal?: AbortSignal) => get<AutomationJob[]>("/automation/jobs", { signal }),
  runAutomationJob: (job: string) => post<AutomationRunResult>(`/automation/run/${encodeURIComponent(job)}`, undefined, LLM),
  proactive: (signal?: AbortSignal) => get<ProactiveMessage[]>("/proactive", { signal }),
  dismissProactive: (id: number) => post<{ dismissed: true }>(`/proactive/${id}/dismiss`),

  // Voice and vision
  voiceStatus: (signal?: AbortSignal) => get<VoiceStatus>("/voice/status", { signal, timeoutMs: 8000 }),
  transcribe: (audio: Blob, filename = "speech.webm", signal?: AbortSignal) => {
    const form = new FormData();
    form.append("audio", audio, filename);
    return request<TranscribeResult>("POST", "/voice/transcribe", { form, signal, timeoutMs: 120000, trackSlow: false });
  },
  /** Returns WAV bytes. Throws ApiError with status 503 when server TTS (Piper) isn't installed. */
  speak: async (text: string, signal?: AbortSignal): Promise<Blob> => {
    const res = await rawFetch("POST", "/voice/speak", {
      body: { text },
      signal,
      accept: "audio/wav",
      timeoutMs: 60000,
      trackSlow: false,
    });
    return res.blob();
  },
  analyzeImage: (image: File, prompt: string, remember = true) => {
    const form = new FormData();
    form.append("image", image);
    if (prompt) form.append("prompt", prompt);
    form.append("remember", remember ? "true" : "false");
    return request<VisionResult>("POST", "/vision/analyze", { form, ...LLM });
  },
};

export type Api = typeof api;
