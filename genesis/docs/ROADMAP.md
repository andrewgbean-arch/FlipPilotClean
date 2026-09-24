# Roadmap

Status as of this build: ✅ done · 🟡 partly done · ⬜ planned

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1. Basic chat | FastAPI, Ollama, React UI, message history, streaming | ✅ |
| 2. Persistent memory | SQLite, ChromaDB, embeddings, hybrid retrieval, ranking, de-duplication, links | ✅ |
| 3. Personality | 10 traits, identity profile, slow capped drift, style directives | ✅ |
| 4. Emotion | 8 emotions, appraisal, decay, tone adaptation, effect on questions | ✅ |
| 5. Learning | Heuristic + LLM extraction, validation, profile, interests, relationship model | ✅ |
| 6. Goals | User and companion goals, progress, follow-ups, completion → timeline | ✅ |
| 7. Reflection | Consolidation, self-reflection, daily/weekly/monthly journal, life timeline | ✅ |
| 8. Voice | Whisper STT, Piper TTS, sentence-streamed speech, hands-free mode | ✅ (needs `requirements-voice.txt` and a voice model) |
| 9. Knowledge graph | Entities, relations, graph-RAG, visualisation, document ingestion | ✅ |
| 10. Autonomy | Proactive follow-ups, reminders, reconnecting, curiosity questions, weekly summaries | ✅ |
| Vision | Image upload, camera stills, OCR, objects, scene description, memory of images | 🟡 works through Ollama multimodal models; no live video stream yet |

## MVP (what you get by running it today)

- Chat in the browser, the desktop app or the terminal, with streaming replies.
- It remembers you: name, work, family, pets, hobbies, projects, goals and events, from the first message.
- "Welcome back" greetings that pick up where you left off and follow up on your goals.
- Its personality, mood and your relationship visibly evolve on the dashboard.
- Voice in and out, local.
- Everything inspectable and editable: memories, profile, goals, journal, timeline, knowledge graph.

## Production hardening (done)

- JSON logs with domain events; health endpoint covering Ollama, models, vector store, database, voice, vision and scheduler.
- Online SQLite backups (7 kept), integrity checks, vector-index self-repair.
- Graceful degradation: without the LLM, it still stores and learns (heuristics). Without embeddings, keyword retrieval takes over. Without voice, the browser's speech APIs take over.
- Optional API token; binds to localhost; CORS allow-list; request size limits.
- A Docker Compose stack (Ollama, backend, nginx frontend); a non-root container; health checks.
- 61 automated tests that run without a GPU or Ollama.

## Next up

1. **Alembic migrations.** The schema is currently created with `create_all`. Add Alembic before the first schema change after real data exists.
2. **Evaluation harness.** Scripted multi-session conversations scored for recall accuracy, false memories, question naturalness and tone, run against each candidate model (llama3.1, mistral, deepseek-r1, qwen).
3. **Streaming voice.** A WebSocket audio stream with server-side VAD and partial transcripts, and barge-in (you can interrupt it while it speaks).
4. **Memory UX.** A "why did you say that?" view linking a reply to the memories and facts it used (the data is already stored per message), and bulk edit and merge.
5. **Embedding upgrades.** Re-embed in the background when the embed model changes (collections are already per model).

## Future expansion

- **Vision+**: live camera mode (a frame every few seconds), opt-in face identification of *people you name* stored locally, document scanning straight into knowledge.
- **Plugins**: a tool-plugin interface (entry points) for calendar (CalDAV/ICS), email summaries, smart home (Home Assistant), weather and fishing tides.
- **Mobile**: a React Native / Expo client talking to your home Genesis over Tailscale/WireGuard; FlipPilot could embed it as its assistant.
- **Multi-user**: the schema already carries `user_id`; add profiles with separate memories per household member.
- **Encrypted at rest**: SQLCipher for the database, and an encrypted Chroma directory.
- **Fine-tuned persona adapters**: optional LoRA trained on *your own* approved conversations, kept separate from memory (memory stays the primary learning mechanism).
