// Types mirroring genesis/docs/API.md. Keep in sync with the backend contract.

export type MemoryType = "episodic" | "semantic" | "procedural" | "emotional" | "personal";
export type Importance = "low" | "medium" | "high" | "critical";

export const MEMORY_TYPES: MemoryType[] = ["episodic", "semantic", "procedural", "emotional", "personal"];
export const IMPORTANCE_LEVELS: Importance[] = ["low", "medium", "high", "critical"];
export const MEMORY_CATEGORIES = [
  "personal",
  "preference",
  "relationship",
  "goal",
  "event",
  "interest",
  "knowledge",
  "reflection",
  "summary",
  "other",
] as const;

export interface Memory {
  id: number;
  title: string;
  content: string;
  memory_type: MemoryType;
  category: string;
  tier: "medium" | "long";
  importance: Importance;
  importance_score: number;
  confidence: number;
  source: string;
  emotional_score: number;
  retrieval_count: number;
  last_recalled: string | null;
  tags: string[];
  related_memory_ids: number[];
  indexed: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type EmotionName =
  | "happy"
  | "curious"
  | "focused"
  | "relaxed"
  | "excited"
  | "concerned"
  | "reflective"
  | "motivated";

export type EmotionState = Record<EmotionName, number>;

export type GoalType =
  | "health"
  | "business"
  | "finance"
  | "learning"
  | "relationships"
  | "projects"
  | "travel"
  | "personal_development"
  | "companion";

export const GOAL_TYPES: GoalType[] = [
  "health",
  "business",
  "finance",
  "learning",
  "relationships",
  "projects",
  "travel",
  "personal_development",
  "companion",
];

export type GoalHorizon = "short" | "medium" | "long";
export type GoalStatus = "active" | "paused" | "completed" | "abandoned";

export interface Goal {
  id: number;
  title: string;
  description: string;
  goal_type: GoalType;
  horizon: GoalHorizon;
  owner: "user" | "companion";
  status: GoalStatus;
  progress: number;
  follow_up_interval_days: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalUpdate {
  id: number;
  note: string;
  progress: number;
  status: GoalStatus;
  source: string;
  created_at: string;
}

export type GoalDetail = Goal & { updates: GoalUpdate[] };

// ---- Health & stats ----

export interface Health {
  status: "ok" | "degraded";
  version: string;
  ollama: {
    available: boolean;
    chat_model: string;
    embed_model: string;
    models: string[];
    /** Optional so older backends without these fields still type-check at runtime. */
    chat_model_installed?: boolean;
    embed_model_installed?: boolean;
  };
  vector_store: { backend: string; count: number };
  database: { ok: boolean; path: string };
  voice: { stt: unknown; tts: unknown };
  vision: { available: boolean; model: string };
  scheduler: { running: boolean };
}

export interface Stats {
  conversations: number;
  messages: number;
  memories: {
    total: number;
    by_type: Record<string, number>;
    by_importance: Record<string, number>;
  };
  knowledge_items: number;
  entities: number;
  goals: { active: number; completed: number };
  journal_entries: number;
  reflections: number;
  timeline_events: number;
}

// ---- Chat ----

export interface ChatRequest {
  message: string;
  conversation_id?: number;
}

export interface MemoryUsed {
  id: number;
  title: string;
  score: number;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  result: string;
}

export interface ChatResponse {
  conversation_id: number;
  message_id: number;
  reply: string;
  emotion: EmotionState;
  mood: string;
  memories_used: MemoryUsed[];
  asked_question: boolean;
  tool_calls: ToolCall[];
  safety_flags: string[];
}

export interface GreetingResponse {
  conversation_id: number;
  message_id: number;
  reply: string;
}

export interface ConversationSummary {
  id: number;
  title: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  summary: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  id: number;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface ConversationDetail {
  id: number;
  title: string;
  started_at: string;
  summary: string;
  messages: ConversationMessage[];
}

// ---- Memory ----

export interface MemoryListQuery {
  memory_type?: MemoryType | "";
  importance?: Importance | "";
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

export interface MemoryAddRequest {
  content: string;
  title?: string;
  memory_type?: MemoryType;
  category?: string;
  importance?: Importance;
  confidence?: number;
  tags?: string[];
  emotional_score?: number;
}

export interface MemorySearchRequest {
  query: string;
  limit?: number;
  memory_types?: MemoryType[];
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
}

export interface MemoryUpdateRequest {
  memory_id: number;
  title?: string;
  content?: string;
  importance?: Importance;
  tags?: string[];
  confidence?: number;
  archived?: boolean;
  memory_type?: MemoryType;
  category?: string;
}

// ---- Profile ----

export interface ProfileField {
  value: unknown;
  confidence: number;
  source: string;
  updated_at: string;
}

export interface Interest {
  name: string;
  category: string;
  strength: number;
  mention_count: number;
  last_mentioned: string;
}

export interface Profile {
  fields: Record<string, ProfileField>;
  interests: Interest[];
}

// ---- Emotion, personality, relationship ----

export interface EmotionsResponse {
  current: EmotionState;
  mood: string;
  history: { timestamp: string; values: EmotionState; trigger: string }[];
}

export interface PersonalityTrait {
  name: string;
  value: number;
  baseline: number;
  description: string;
}

export interface PersonalityProfile {
  core_values: string[];
  beliefs: string[];
  communication_style: string;
  language_style: string;
  humour_style: string;
  question_frequency: number;
  teachability: number;
  curiosity_level: number;
}

export interface PersonalityResponse {
  traits: PersonalityTrait[];
  profile: PersonalityProfile;
}

export const RELATIONSHIP_LEVELS = [
  "Acquaintance",
  "Familiar",
  "Friend",
  "Close Companion",
  "Trusted Companion",
] as const;

export interface Relationship {
  level: string;
  score: number;
  trust: number;
  familiarity: number;
  interaction_count: number;
  shared_experiences: number;
  conversation_depth: number;
  support_level: number;
  shared_interests: string[];
  next_level: string | null;
  progress_to_next: number;
}

// ---- Knowledge ----

export interface KnowledgeItem {
  id: number;
  statement: string;
  subject: string;
  predicate: string;
  object: string;
  source: string;
  confidence: number;
  evidence: unknown;
  retrieval_count: number;
  created_at: string;
}

export interface GraphNode {
  id: string | number;
  label: string;
  type: string;
  weight: number;
}

export interface GraphEdge {
  source: string | number;
  target: string | number;
  relation: string;
  confidence: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DocumentUploadResult {
  document: unknown;
  chunks: number;
  memories_created: number;
}

// ---- Journal, timeline, reflections ----

export type JournalPeriod = "daily" | "weekly" | "monthly";

export interface JournalEntry {
  id: number;
  period: JournalPeriod;
  period_start: string;
  period_end: string;
  title: string;
  content: string;
  highlights: string[];
  created_at: string;
}

export interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  event_date: string;
  importance: string | number;
  source: string;
}

export interface TimelineCreate {
  title: string;
  description?: string;
  category?: string;
  event_date?: string;
  importance?: string | number;
}

export interface Reflection {
  id: number;
  question: string;
  content: string;
  insights: string[];
  created_at: string;
}

// ---- Settings, tools, automation, proactive ----

export type Settings = Record<string, unknown>;

export interface ToolInfo {
  name: string;
  description: string;
  parameters: unknown;
}

export interface ToolLog {
  id: number;
  tool_name: string;
  arguments: unknown;
  ok: boolean;
  result: string;
  created_at: string;
}

export interface AutomationJob {
  name: string;
  interval_seconds: number;
  last_run: string | null;
  last_status: string | null;
}

export interface AutomationRunResult {
  job: string;
  status: string;
  detail: unknown;
}

export interface ProactiveMessage {
  id: number;
  kind: string;
  content: string;
  created_at: string;
}

// ---- Voice & vision ----

export interface VoiceStatus {
  stt: { available: boolean; model: string; detail: string };
  tts: { available: boolean; voice: string; detail: string };
}

export interface TranscribeResult {
  text: string;
  language: string;
}

export interface VisionResult {
  description: string;
  model: string;
  memory_id: number | null;
}
