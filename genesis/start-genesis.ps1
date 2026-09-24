# Start Genesis on Windows (PowerShell).
#   Right-click > "Run with PowerShell", or in a terminal:  .\start-genesis.ps1
# First run installs everything (a few minutes). Needs: Python 3.11+, Node.js 20+, Ollama (https://ollama.com/download).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$chatModel = if ($env:GENESIS_CHAT_MODEL) { $env:GENESIS_CHAT_MODEL } else { "llama3.1:8b" }

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "Missing $cmd. $hint" -ForegroundColor Red; exit 1 }
}
Need python "Install Python 3.11+ from https://www.python.org/downloads/ (tick 'Add to PATH')."
Need npm "Install Node.js 20+ from https://nodejs.org/"
Need ollama "Install Ollama from https://ollama.com/download"

Write-Host "== Models ==" -ForegroundColor Cyan
ollama pull $chatModel
ollama pull nomic-embed-text

Write-Host "== Backend ==" -ForegroundColor Cyan
Set-Location $backend
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
if ($env:GENESIS_VOICE -ne "0") {
  & .\.venv\Scripts\python.exe -m pip install -q -r requirements-voice.txt
  if (-not (Test-Path "data\voices\en_US-lessac-medium.onnx")) { & .\.venv\Scripts\python.exe scripts\download_voice.py }
}
Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","genesis.main:app","--host","127.0.0.1","--port","8000" -WorkingDirectory $backend

Write-Host "== Frontend ==" -ForegroundColor Cyan
Set-Location $frontend
if (-not (Test-Path "node_modules")) { npm install }
Start-Process "http://localhost:5173"
npm run dev
