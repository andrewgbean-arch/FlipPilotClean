# Fixing Genesis on Windows: a guide for a helper

**The situation:** Genesis is a local AI companion app (Python backend and a browser UI). It runs its AI model through **Ollama**. Genesis itself works, but Ollama can't run any model. The error is:

```
Ollama error 500: error starting llama-server: llama-server binary not found
(checked: C:\Users\<user>\AppData\Local\Programs\Ollama\llama-server.exe, ...\lib\ollama\llama-server.exe)
```

So Ollama's engine file `llama-server.exe` is missing. The usual causes are an interrupted install or auto-update, or antivirus (Windows Defender or a third-party product) quarantining it.

## Quick fix (automatic)

Open **PowerShell** (no admin needed) and paste:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd "C:\Genesis\FlipPilotClean-claude-sweet-tesla-2k8hsa\genesis"
Invoke-WebRequest "https://raw.githubusercontent.com/andrewgbean-arch/FlipPilotClean/claude/sweet-tesla-2k8hsa/genesis/fix-ollama.ps1" -OutFile fix-ollama.ps1
.\fix-ollama.ps1
```

The script:
1. Checks whether `llama-server.exe` exists and whether Windows Defender removed Ollama files.
2. If Defender did, it offers to add a Defender exclusion for the Ollama folder. This needs admin, and it asks first.
3. Downloads a fresh Ollama installer and reinstalls silently. Downloaded models are kept.
4. Starts Ollama and downloads any missing models (`llama3.1:8b`, `nomic-embed-text`).
5. Asks the model to say hello, which proves it really works.

It saves a report to the Desktop as **`ollama-report.txt`**.

## Manual fix (if the script doesn't solve it)

1. **Quit Ollama:** right-click the tray icon and choose Quit. Then confirm in Task Manager that no `ollama`, `ollama app` or `llama-server` processes are left.
2. **Check antivirus:** open Windows Security, then Virus & threat protection, then Protection history. Restore or allow anything involving Ollama or llama-server. If a third-party antivirus is installed (Norton, McAfee, Avast, …), check its quarantine too and add an exception for `%LOCALAPPDATA%\Programs\Ollama`.
3. **Uninstall** Ollama (Settings, then Apps). If `%LOCALAPPDATA%\Programs\Ollama` still exists afterwards, delete it. Leave `%USERPROFILE%\.ollama` alone, because that folder holds the downloaded models.
4. **Reinstall** from https://ollama.com/download/windows (or https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe).
5. **Verify:** `dir "$env:LOCALAPPDATA\Programs\Ollama" -Recurse -Filter llama-server*.exe` should find the file, and `ollama run llama3.1:8b "say hello"` should answer.
6. **If the machine has less than 16 GB RAM**, use a smaller model: `ollama pull llama3.2:3b`, then set it in Genesis under **Settings, then Chat model** as `llama3.2:3b`.

## Starting Genesis afterwards

Double-click the **Genesis** icon on the Desktop, or run:

```powershell
cd "C:\Genesis\FlipPilotClean-claude-sweet-tesla-2k8hsa\genesis"
Set-ExecutionPolicy -Scope Process Bypass -Force
.\start-genesis.ps1
```

It opens at http://localhost:5173. The health check at http://127.0.0.1:8000/api/health shows what Genesis can see: Ollama, the models, voice and the database.
