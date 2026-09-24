#!/usr/bin/env bash
# Start Genesis on macOS / Linux:  ./start-genesis.sh
# First run installs everything. Needs: Python 3.11+, Node.js 20+, Ollama (https://ollama.com/download).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CHAT_MODEL="${GENESIS_CHAT_MODEL:-llama3.1:8b}"

need() { command -v "$1" >/dev/null || { echo "Missing $1. $2"; exit 1; }; }
need python3 "Install Python 3.11+."
need npm "Install Node.js 20+ from https://nodejs.org/"
need ollama "Install Ollama from https://ollama.com/download"

echo "== Models =="
curl -fs http://127.0.0.1:11434/api/version >/dev/null || (ollama serve >/dev/null 2>&1 &) ; sleep 2
ollama pull "$CHAT_MODEL"
ollama pull nomic-embed-text

echo "== Backend =="
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
if [ "${GENESIS_VOICE:-1}" != "0" ]; then
  .venv/bin/pip install -q -r requirements-voice.txt
  [ -f data/voices/en_US-lessac-medium.onnx ] || .venv/bin/python scripts/download_voice.py
fi
.venv/bin/uvicorn genesis.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

echo "== Frontend =="
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
( sleep 3; command -v open >/dev/null && open http://localhost:5173 || xdg-open http://localhost:5173 ) >/dev/null 2>&1 &
npm run dev
