# Genesis desktop

A thin Electron shell around the Genesis web frontend (`../frontend`).

## Run

```bash
npm install

# Development: start the frontend dev server first, then open it in Electron
(cd ../frontend && npm install && npm run dev)
npm run dev

# Production-style: build the frontend once, then load it from disk
(cd ../frontend && npm run build)
npm start
```

In dev mode the window loads `http://localhost:5173` (override it with `GENESIS_DEV_URL`).
Otherwise it loads `../frontend/dist/index.html` over `file://`. The frontend is built with
`base: "./"` and uses a `HashRouter`, so this works without a web server.

## Starting the backend with the app

```bash
GENESIS_SPAWN_BACKEND=1 npm start
```

This runs `python -m uvicorn genesis.main:app --host 127.0.0.1 --port 8000` in `../backend`.
It uses `../backend/.venv/bin/python` (or `.venv\Scripts\python.exe` on Windows) if that
exists, and `python3`/`python` otherwise. The backend is stopped when the app quits.
Without the flag, start the backend yourself. The app shows a "can't reach Genesis" banner
and keeps retrying until the backend is up.

## Notes

- Security: `contextIsolation` is on, `nodeIntegration` is off and the renderer is
  sandboxed. The preload script only exposes `window.genesisDesktop`
  (`{ isDesktop, platform, versions }`).
- Microphone access is granted automatically to the app's own origin, for push-to-talk and
  hands-free mode. Every other permission request is denied.
- Only one instance runs at a time. Launching it again focuses the existing window.
- External links open in your default browser.
- If `GENESIS_API_TOKEN` is set on the backend, enter the token in **Settings → API token**.
- The browser speech-recognition fallback (`webkitSpeechRecognition`) doesn't work in
  Electron. Voice input there depends on the backend's `/voice/transcribe` (Whisper). Spoken
  replies fall back to the system voices through `speechSynthesis` when Piper isn't installed.
- If `npm install` skipped Electron's binary download, run `node node_modules/electron/install.js`.
