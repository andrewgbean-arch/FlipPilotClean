# Genesis

**A local-first AI companion that remembers you, learns from every conversation, and grows over time.**

Genesis isn't a stateless chatbot. It remembers what you tell it (your name, the people in your life, your hobbies, projects and goals), follows up on them later, develops its own personality and mood, and builds a relationship with you over weeks and months. Everything runs on your own computer through [Ollama](https://ollama.com). No cloud, no account, and your data never leaves your machine.

```
You:      Hello.
Genesis:  Welcome back, Andrew. You mentioned yesterday you were restoring your fishing boat.
          How's that going?
```

## What it does

| | |
|---|---|
| 💬 **Conversation** | Natural, streaming chat that is warm, concise and asks good follow-up questions (never an interrogation) |
| 🧠 **Long-term memory** | Personal, episodic, semantic, procedural and emotional memories, each with importance, confidence and recall tracking, retrieved with RAG before every reply |
| 📚 **Learning** | Pulls facts, profile details, interests, goals, relationships and life events out of conversation, validates them, and links them into a knowledge graph |
| 🎭 **Personality** | 10 traits (curiosity, empathy, humour, …) that drift slowly with experience and never change overnight |
| 💛 **Emotions** | 8 simulated states that react to what you say and shape its tone, then settle back over time |
| 🤝 **Relationship** | Trust, familiarity and depth grow from Acquaintance to Trusted Companion, which takes weeks, not one evening |
| 🎯 **Goals** | Tracks your goals and checks in on them at the right time ("You mentioned wanting to learn Python. How's it going?") |
| 🪞 **Reflection** | Consolidates memories, reflects on what it has learned, and writes a daily, weekly and monthly journal and a life timeline |
| 🗣️ **Voice** | Whisper speech-to-text and Piper text-to-speech, both local, with a hands-free continuous conversation mode |
| 👁️ **Vision** | Show it a photo: it can describe it, read text in it and remember it (via a local multimodal model) |
| 🛠️ **Tools** | Notes, tasks and reminders, memory search, reading your files (sandboxed), optional local web search |
| 🛡️ **Safety** | Prompt-injection detection, memory-poisoning protection, secret redaction, validated tools, loop limits, backups |

## Quick start

You need **[Ollama](https://ollama.com/download)**, **Python 3.11+** and **Node.js 20+**. A machine with 16 GB RAM runs the default 8B model comfortably; a GPU makes it faster.

**Windows:** open PowerShell in this folder and run:

```powershell
.\start-genesis.ps1
```

**macOS / Linux:**

```bash
./start-genesis.sh
```

The script pulls the models (`llama3.1:8b` and `nomic-embed-text`), installs everything, starts the backend on `http://127.0.0.1:8000` and opens the app at `http://localhost:5173`. Set `GENESIS_VOICE=0` to skip the voice install. Set `GENESIS_CHAT_MODEL=mistral` (or `deepseek-r1:8b`, `llama3`, …) to use another model.

### With Docker

```bash
docker compose up -d
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull nomic-embed-text
# open http://localhost:8080
```

### Manual

```bash
# backend
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-voice.txt             # optional: local voice
python scripts/download_voice.py                  # optional: Piper voice
uvicorn genesis.main:app --port 8000

# frontend (second terminal)
cd frontend && npm install && npm run dev

# or the desktop app (after `npm run build` in frontend/)
cd desktop && npm install && npm start
```

Or just talk in the terminal: `cd backend && python -m genesis.cli chat`.

## Models

| Purpose | Default | Alternatives |
|---|---|---|
| Chat | `llama3.1:8b` | `llama3`, `mistral`, `deepseek-r1:8b` (its thinking is hidden), `qwen2.5` |
| Embeddings | `nomic-embed-text` | any Ollama embedding model (each gets its own vector collection) |
| Vision | `llama3.2-vision` | `llava` |

If the configured chat model isn't installed, Genesis falls back through `GENESIS_FALLBACK_MODELS`. With Ollama stopped it still saves what you say and learns simple facts, and it tells you what to run.

## Your data

Everything lives in `backend/data/`: `genesis.db` (SQLite), `chroma/` (memory vectors), `backups/` (a daily copy, the last 7 kept), `voices/` and `files/` (the only folder the file tool may read by default). In the app you can view, edit, archive or delete any memory, correct your profile, and change how often it asks questions.

## Configuration

Copy `backend/.env.example` to `backend/.env`. The useful settings are:

- `GENESIS_CHAT_MODEL`, `GENESIS_EMBED_MODEL`, `GENESIS_VISION_MODEL`, `GENESIS_OLLAMA_URL`
- `GENESIS_API_TOKEN`: require a token if you ever expose the API beyond localhost
- `GENESIS_FILE_TOOL_ROOTS`: extra folders it may read
- `GENESIS_SEARXNG_URL`: optional local web search

Behaviour settings (question frequency, reply length, autonomy, voice, learning) are in the app's **Settings** page.

## Development

```bash
cd backend && pip install -r requirements-dev.txt
pytest                    # 61 tests; uses a fake LLM, no Ollama needed
ruff check genesis tests
python -m genesis.cli schema > ../docs/schema.sql

cd frontend && npm run typecheck && npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): modules, the per-turn pipeline, design decisions, safety model
- [Memory system](docs/MEMORY.md): memory types, importance, retrieval and ranking, consolidation, knowledge graph
- [API](docs/API.md): every endpoint
- [Database schema](docs/schema.sql)
- [Roadmap](docs/ROADMAP.md): phases, MVP vs production, what's next

## Honest limits

- Genesis is only as articulate as the local model you run. 8B models are good conversationalists but can occasionally misremember or miss a fact. Everything it believes about you is visible and editable in the Memories and Profile pages.
- Its emotions are *simulated states* that shape its tone. It will tell you it's an AI if you ask.
- It learns through memory, not by retraining the model or changing its own code.
