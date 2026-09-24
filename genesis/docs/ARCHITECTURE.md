# Genesis architecture

Genesis is a local-first AI companion. Everything (the language model, memory, voice and data) runs on your own machine. It's designed around **continuity**: every conversation leaves the companion knowing you a little better, and it carries that forward.

## System diagram

```
 ┌──────────────────────────── UI layer ────────────────────────────┐
 │  React (Vite) web app  ·  Electron desktop shell  ·  CLI chat     │
 │  Chat (streaming, voice, images) · Dashboard · Memories ·         │
 │  Knowledge graph · Journal & timeline · Profile · Settings        │
 └───────────────┬──────────────────────────────────────────────────┘
                 │ HTTP + SSE (/api), optional X-Genesis-Token
 ┌───────────────▼──────────────── API layer (FastAPI) ─────────────┐
 │ chat · memory · profile · goals · emotions · personality ·        │
 │ relationship · knowledge · journal · timeline · reflections ·     │
 │ settings · tools · automation · proactive · voice · vision        │
 └───────────────┬──────────────────────────────────────────────────┘
                 │
 ┌───────────────▼──────────── Conversation engine ─────────────────┐
 │ 1 safety  2 appraisal  3 emotion  4 retrieval  5 context           │
 │ 6 question plan  7 prompt  8 LLM (+tools)  9 store  10 evolve      │
 └──┬─────────┬──────────┬───────────┬──────────┬──────────┬─────────┘
    │         │          │           │          │          │
 ┌──▼───┐ ┌───▼────┐ ┌───▼─────┐ ┌───▼───┐ ┌────▼────┐ ┌───▼──────┐
 │Memory│ │Persona-│ │Emotion  │ │Relat- │ │Goals    │ │Question  │
 │engine│ │lity    │ │engine   │ │ionship│ │engine   │ │engine    │
 └──┬───┘ └────────┘ └─────────┘ └───────┘ └─────────┘ └──────────┘
    │  (background, after each reply)
 ┌──▼──────── Learning engine ──────────┐   ┌──── Automation engine ────┐
 │ heuristics + LLM JSON extraction →   │   │ reindex · consolidate ·   │
 │ validate → memories, profile,        │   │ proactive · reflect ·     │
 │ interests, goals, knowledge graph,   │   │ journal · backup ·        │
 │ timeline                             │   │ integrity                 │
 └──────────────────────────────────────┘   └───────────────────────────┘
 ┌──────────── Knowledge engine ─────────┐  ┌──── Tool engine ───────────┐
 │ facts with provenance, entity graph,  │  │ remember · notes · tasks · │
 │ graph-RAG, document ingestion         │  │ read_file (sandboxed) ·    │
 └───────────────────────────────────────┘  │ web_search (SearXNG) · time│
 ┌──────────── Voice / Vision ───────────┐  └────────────────────────────┘
 │ Whisper STT · Piper TTS · Ollama      │  ┌──── Safety layer ──────────┐
 │ multimodal (describe, OCR, objects)   │  │ injection detection ·      │
 └───────────────────────────────────────┘  │ memory validation · secret │
                                            │ redaction · loop guards    │
 ┌──────────────── Database layer ──────────────────────────────────────┐
 │ SQLite (WAL, foreign keys): the source of truth, 26 tables            │
 │ ChromaDB: embeddings keyed by memory id, rebuildable from SQLite      │
 │ Ollama: chat (llama3.1 / mistral / deepseek-r1), nomic-embed-text,    │
 │         llama3.2-vision                                               │
 └──────────────────────────────────────────────────────────────────────┘
```

## Folder structure

```
genesis/
├── README.md                  quick start
├── docker-compose.yml         ollama + backend + frontend
├── docs/
│   ├── ARCHITECTURE.md        this file
│   ├── MEMORY.md              memory system design
│   ├── API.md                 HTTP contract
│   ├── ROADMAP.md             phases, MVP vs production, future plans
│   └── schema.sql             generated SQL schema
├── backend/
│   ├── genesis/
│   │   ├── main.py            FastAPI app factory
│   │   ├── services.py        wires every engine (dependency container)
│   │   ├── config.py          GENESIS_* environment config
│   │   ├── settings_store.py  runtime settings (UI-editable)
│   │   ├── logging_setup.py   structured JSON logs + domain events
│   │   ├── cli.py             serve · chat · schema · run-job · backup
│   │   ├── db/                SQLAlchemy models and SQLite setup
│   │   ├── llm/               Ollama client, embedder, fake LLM for tests
│   │   ├── conversation/      turn pipeline, prompts, question engine
│   │   ├── memory/            memory engine, vector store, consolidation
│   │   ├── learning/          extraction (heuristic + LLM) and application
│   │   ├── personality/       traits, identity profile, drift rules
│   │   ├── emotion/           appraisal, emotion states, decay, tone
│   │   ├── relationship/      trust/familiarity/depth and levels
│   │   ├── profile/           user profile fields and interests
│   │   ├── goals/             goals, progress, follow-ups
│   │   ├── knowledge/         facts, entity graph, documents
│   │   ├── reflection/        reflection, journal, life timeline
│   │   ├── automation/        scheduler and proactive behaviour
│   │   ├── tools/             tool registry and sandboxed tools
│   │   ├── safety/            guards
│   │   ├── voice/             Whisper and Piper
│   │   ├── vision/            multimodal image understanding
│   │   └── api/               routes, request schemas, serialisers
│   ├── tests/                 pytest suite (fake LLM, no Ollama needed)
│   └── scripts/               download_voice.py
├── frontend/                  React + TypeScript (Vite), nginx Dockerfile
└── desktop/                   Electron shell
```

## A turn, step by step

1. **Safety.** The message is sanitised (control characters and chat-template tokens are stripped). Prompt-injection patterns are flagged, and secrets (card numbers, passwords, API keys) are redacted *before* anything is stored or sent to the model.
2. **Appraisal.** A lexicon-based appraisal finds cues (joy, sadness, stress, achievement, learning, joke, …) and a valence.
3. **Emotion.** The companion's eight emotion values react to those cues and are stored as a snapshot. Between turns they decay back to baseline (3-hour half-life).
4. **Retrieval.** The message (plus the previous exchange for very short replies) is embedded and searched in ChromaDB, and a keyword search in SQLite runs alongside. Candidates are ranked by relevance, importance, recency, recall frequency, emotional weight and confidence. Critical "core" memories are always included, plus knowledge-graph facts about any entity the message mentions.
5. **Context.** The context holds the user's profile, top interests and active goals, the relationship stage and its tone guidance, the previous conversation (on the first turns of a new one) and the time since you last spoke.
6. **Question plan.** The question engine decides whether to ask and about what: care > clarifying a contradiction > a due goal follow-up > something just mentioned > a question from reflection > a gap in the profile. It backs off after recent questions.
7. **Prompt.** A system prompt renders identity, personality directives, mood and tone, relationship, memories (quoted as data, never instructions), and response rules.
8. **LLM.** Ollama generates the reply (streamed). If the message looks like it needs a tool (notes, reminders, files, search), tool calling is enabled with at most 3 rounds and duplicate-call detection. `<think>` blocks from reasoning models are hidden.
9. **Store.** The reply is saved with metadata (mood, memories used, question kind, tool calls).
10. **Evolve.** Relationship metrics update, personality traits drift by tiny, capped amounts, and follow-up bookkeeping runs.
11. **Learn** (background). Facts, profile fields, interests, goals, goal progress, entities and relations, and life events are extracted, validated and stored.

The database session is never held open during an LLM call, so the SQLite writer lock stays free while the model thinks.

## Design decisions

| Decision | Why |
|---|---|
| SQLite is the source of truth; ChromaDB only holds vectors | The vector index can be rebuilt at any time (the `reindex` job), and a changed embedding model gets its own collection. |
| Hybrid retrieval | Memory keeps working (by keyword) when the embedding model is offline. New memories are marked `indexed=false` and embedded later. |
| Heuristic extraction always runs, and the LLM adds to it | Genesis learns names, places, jobs, pets, family, likes, goals and events even with a small or offline model. |
| Learning never edits code or prompts | Growth happens only through memory, so it's inspectable and reversible in the Memories UI. |
| Personality drift caps (0.4 per turn, 1.5 per day, ±30 from baseline) | It feels like it grows, but it never changes overnight. |
| Relationship levels need interactions *and* active days | It can't become a "Trusted Companion" in one evening. |
| Contradictions are kept, not overwritten | A lower-confidence conflicting fact is stored as a `conflict`, and the companion may casually ask about it. |
| Emotions are presented as simulated states | The system prompt tells the model to be honest that it's an AI, and not to claim more than that. |
| Messages flagged for injection are never learned from | This prevents memory poisoning. |
| Tools are validated by pydantic, logged, sandboxed and capped | This prevents invalid tool execution and runaway loops. |

## Safety model

| Threat | Mitigation |
|---|---|
| Prompt injection (user text, documents, tool output, old memories) | Pattern detection; role-token stripping; retrieved text quoted as data; a safety note is added to the prompt; flagged messages aren't learned from; tools are disabled for flagged turns |
| Memory poisoning | `validate_memory`: length, instruction/directive detection, injection detection, secret detection, per-source minimum confidence |
| Data corruption | SQLite WAL, foreign keys, CHECK constraints, transactions per unit of work, daily online backups (7 kept), `PRAGMA integrity_check` |
| Broken memory chains | `ON DELETE CASCADE` on links, and the reindex job removes orphaned vectors |
| Circular loops | Tool round limit, duplicate-call detection, per-job non-blocking locks, persisted job schedule |
| Invalid tool execution | Registry allow-list, pydantic argument validation, path sandbox for files, size limits, result truncation, every call logged |
| Exposure | Binds to 127.0.0.1 by default; optional `GENESIS_API_TOKEN`; CORS allow-list |

## Logging

Every log line is JSON. Domain events carry an `event` key: `memory.created`, `memory.rejected`, `memory.retrieval`, `memory.consolidated`, `learning.completed`, `goal.created`, `goal.updated`, `goal.follow_up`, `tool.executed`, `reflection.created`, `journal.written`, `emotion.update`, `personality.drift`, `relationship.level_up`, `safety.flagged`, `automation.job`, `chat.reply`, and more.

```bash
uvicorn genesis.main:app | jq 'select(.event == "memory.created")'
```
