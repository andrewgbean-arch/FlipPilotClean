# Genesis API

Base URL: `http://127.0.0.1:8000/api` (all endpoints below are relative to `/api`).

Genesis is single-user and local-first. It binds to localhost by default. If
`GENESIS_API_TOKEN` is set, every request must send `X-Genesis-Token: <token>`.

Timestamps are ISO-8601 UTC strings. Scores documented as `0-100` are floats.

## Shared shapes

```ts
type Memory = {
  id: number
  title: string
  content: string
  memory_type: "episodic" | "semantic" | "procedural" | "emotional" | "personal"
  category: string          // personal, preference, relationship, goal, event, interest, knowledge, reflection, summary, other
  tier: "medium" | "long"   // short-term memory is the live conversation itself
  importance: "low" | "medium" | "high" | "critical"
  importance_score: number  // 0-1
  confidence: number        // 0-1
  source: string            // conversation, user, reflection, document, consolidation, tool, vision
  emotional_score: number   // -1 (painful) .. 1 (joyful)
  retrieval_count: number
  last_recalled: string | null
  tags: string[]
  related_memory_ids: number[]
  indexed: boolean          // embedding stored in the vector database
  archived: boolean
  created_at: string
  updated_at: string
}

type EmotionState = Record<
  "happy" | "curious" | "focused" | "relaxed" | "excited" | "concerned" | "reflective" | "motivated",
  number                    // 0-100
>

type Goal = {
  id: number
  title: string
  description: string
  goal_type: "health" | "business" | "finance" | "learning" | "relationships" | "projects" | "travel" | "personal_development" | "companion"
  horizon: "short" | "medium" | "long"
  owner: "user" | "companion"
  status: "active" | "paused" | "completed" | "abandoned"
  progress: number          // 0-100
  follow_up_interval_days: number
  last_follow_up_at: string | null
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
}
```

## Health and stats

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{status: "ok" \| "degraded", version, ollama: {available, chat_model, embed_model, models: string[], chat_model_installed, embed_model_installed}, vector_store: {backend, count}, database: {ok, path}, voice: {stt, tts}, vision: {available, model}, scheduler: {running}}` |
| GET | `/stats` | `{conversations, messages, memories: {total, by_type: Record<string, number>, by_importance: Record<string, number>}, knowledge_items, entities, goals: {active, completed}, journal_entries, reflections, timeline_events}` |

## Chat

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/chat` | `{message: string, conversation_id?: number}` | `ChatResponse` |
| POST | `/chat/stream` | same as `/chat` | Server-Sent Events (see below) |
| POST | `/chat/greeting` | `{}` | `{conversation_id, message_id, reply}`: a "welcome back" opener that recalls recent topics and due goal follow-ups. It starts a new conversation. |
| GET | `/conversations` | | `{id, title, started_at, last_message_at, message_count, summary}[]` |
| GET | `/conversations/{id}` | | `{id, title, started_at, summary, messages: {id, role: "user"\|"assistant"\|"system", content, created_at}[]}` |
| DELETE | `/conversations/{id}` | | `{deleted: true}` |

```ts
type ChatResponse = {
  conversation_id: number
  message_id: number
  reply: string
  emotion: EmotionState
  mood: string                          // dominant emotion label, e.g. "curious"
  memories_used: {id: number, title: string, score: number}[]
  asked_question: boolean
  tool_calls: {name: string, arguments: object, ok: boolean, result: string}[]
  safety_flags: string[]                // e.g. ["prompt_injection"]
}
```

`/chat/stream` event types (`event:` line followed by a JSON `data:` line):

- `meta`: `{conversation_id}`
- `token`: `{text}` (append to the reply)
- `done`: `ChatResponse` (the final reply)
- `error`: `{detail}`

## Memory

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/memory` | `?memory_type=&importance=&include_archived=false&limit=50&offset=0` | `Memory[]` (newest first) |
| GET | `/memory/{id}` | | `Memory` |
| POST | `/memory/add` | `{content, title?, memory_type?, category?, importance?, confidence?, tags?, emotional_score?}` | `Memory` |
| POST | `/memory/search` | `{query, limit?: 10, memory_types?: string[]}` | `{memory: Memory, score: number}[]` |
| POST | `/memory/update` | `{memory_id, title?, content?, importance?, tags?, confidence?, archived?, memory_type?, category?}` | `Memory` |
| POST | `/memory/delete` | `{memory_id}` | `{deleted: true}` |

## Profile

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/profile` | | `{fields: Record<string, {value, confidence, source, updated_at}>, interests: {name, category, strength, mention_count, last_mentioned}[]}` |
| PUT | `/profile` | `{field, value}` | the same shape as GET |

## Goals

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/goals` | `?status=active` | `Goal[]` |
| POST | `/goals` | `{title, description?, goal_type?, horizon?, owner?, follow_up_interval_days?}` | `Goal` |
| GET | `/goals/{id}` | | `Goal & {updates: {id, note, progress, status, source, created_at}[]}` |
| POST | `/goals/update` | `{goal_id, status?, progress?, note?}` | `Goal` |

## Emotion, personality and relationship

| Method | Path | Returns |
|---|---|---|
| GET | `/emotions` | `{current: EmotionState, mood: string, history: {timestamp, values: EmotionState, trigger}[]}` |
| GET | `/personality` | `{traits: {name, value, baseline, description}[], profile: {core_values: string[], beliefs: string[], communication_style, language_style, humour_style, question_frequency, teachability, curiosity_level}}` |
| PUT | `/personality/profile` | body: any subset of `profile`; returns the same as GET |
| GET | `/relationship` | `{level, score, trust, familiarity, interaction_count, shared_experiences, conversation_depth, support_level, shared_interests: string[], next_level: string \| null, progress_to_next: number}` |

Relationship levels, in order: `Acquaintance`, `Familiar`, `Friend`, `Close Companion`, `Trusted Companion`.

## Knowledge

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/knowledge` | `?limit=100` | `{id, statement, subject, predicate, object, source, confidence, evidence, retrieval_count, created_at}[]` |
| POST | `/knowledge` | `{statement, subject?, predicate?, object?, source?, confidence?}` | knowledge item |
| GET | `/knowledge/graph` | | `{nodes: {id, label, type, weight}[], edges: {source, target, relation, confidence}[]}` |
| POST | `/documents/upload` | multipart `file` (.txt, .md) | `{document, chunks, memories_created}` |

## Journal, timeline and reflections

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/journal` | `?period=daily\|weekly\|monthly` | `{id, period, period_start, period_end, title, content, highlights: string[], created_at}[]` |
| POST | `/journal/generate` | `{period}` | journal entry |
| GET | `/timeline` | | `{id, title, description, category, event_date, importance, source}[]` (chronological) |
| POST | `/timeline` | `{title, description?, category?, event_date?, importance?}` | timeline event |
| GET | `/reflections` | | `{id, question, content, insights: string[], created_at}[]` |
| POST | `/reflections/run` | `{}` | reflection |

## Settings, tools, automation and proactive

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/settings` | | `Record<string, any>` |
| PUT | `/settings` | `Record<string, any>` (known keys only) | `Record<string, any>` |
| GET | `/tools` | | `{name, description, parameters}[]` |
| POST | `/tools/execute` | `{name, arguments}` | `{ok, result}` |
| GET | `/tools/logs` | | `{id, tool_name, arguments, ok, result, created_at}[]` |
| GET | `/automation/jobs` | | `{name, interval_seconds, last_run, last_status}[]` |
| POST | `/automation/run/{job}` | | `{job, status, detail}` |
| GET | `/proactive` | | `{id, kind, content, created_at}[]` (undelivered) |
| POST | `/proactive/{id}/dismiss` | | `{dismissed: true}` |

Settings keys: `companion_name`, `user_name`, `chat_model`, `question_frequency` (0-100),
`response_length` (`short`/`medium`/`long`), `autonomy_enabled`, `proactive_enabled`,
`voice_enabled`, `tts_voice`, `learning_enabled`, `reflection_enabled`, `temperature`.

## Voice and vision

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/voice/status` | | `{stt: {available, model, detail}, tts: {available, voice, detail}}` |
| POST | `/voice/transcribe` | multipart `audio` (webm/wav/ogg) | `{text, language}` |
| POST | `/voice/speak` | `{text}` | `audio/wav` bytes. Returns 503 when Piper isn't installed (the UI then falls back to browser speech). |
| POST | `/vision/analyze` | multipart `image`, optional `prompt`, optional `remember` ("true"/"false") | `{description, model, memory_id}` |
