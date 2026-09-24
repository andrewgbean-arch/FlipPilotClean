// Genesis desktop shell (Electron main process).
//
//   npm run dev    -> loads the Vite dev server at http://localhost:5173
//   npm start      -> loads ../frontend/dist/index.html (run `npm run build` in ../frontend first)
//
// Environment:
//   GENESIS_DEV=1            use the dev server (set by `npm run dev`)
//   GENESIS_DEV_URL=...      override the dev server URL
//   GENESIS_SPAWN_BACKEND=1  start the Python backend (uvicorn) with the app and stop it on quit

"use strict";

const { app, BrowserWindow, session, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const isDev = process.env.GENESIS_DEV === "1";
const DEV_URL = process.env.GENESIS_DEV_URL || "http://localhost:5173";
const DIST_INDEX = path.resolve(__dirname, "..", "frontend", "dist", "index.html");
const BACKEND_DIR = path.resolve(__dirname, "..", "backend");

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import("node:child_process").ChildProcess | null} */
let backend = null;

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(onReady);
}

// ---------------------------------------------------------------------------
// Backend process (optional)
// ---------------------------------------------------------------------------

function pythonExecutable() {
  const venv =
    process.platform === "win32"
      ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
      : path.join(BACKEND_DIR, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return venv;
  return process.platform === "win32" ? "python" : "python3";
}

function startBackend() {
  if (process.env.GENESIS_SPAWN_BACKEND !== "1" || backend) return;
  const python = pythonExecutable();
  const args = ["-m", "uvicorn", "genesis.main:app", "--host", "127.0.0.1", "--port", "8000"];
  console.log(`[genesis] starting backend: ${python} ${args.join(" ")} (cwd ${BACKEND_DIR})`);
  try {
    backend = spawn(python, args, {
      cwd: BACKEND_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      // Own process group on POSIX so the whole tree (uvicorn workers) can be stopped together.
      detached: process.platform !== "win32",
      windowsHide: true,
    });
  } catch (err) {
    console.error("[genesis] failed to start backend:", err);
    backend = null;
    return;
  }
  backend.stdout?.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  backend.stderr?.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  backend.on("error", (err) => {
    console.error("[genesis] backend error:", err.message);
    backend = null;
  });
  backend.on("exit", (code, signal) => {
    console.log(`[genesis] backend exited (code ${code}, signal ${signal})`);
    backend = null;
  });
}

function stopBackend() {
  const proc = backend;
  if (!proc || proc.exitCode !== null || proc.pid === undefined) return;
  backend = null;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true });
    } else {
      process.kill(-proc.pid, "SIGTERM");
      // Escalate if it hasn't gone after a moment.
      setTimeout(() => {
        try {
          process.kill(-proc.pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }, 3000).unref();
    }
  } catch (err) {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
    console.error("[genesis] error stopping backend:", err && err.message);
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function appOrigin() {
  return isDev ? new URL(DEV_URL).origin : "file://";
}

function isAppUrl(url) {
  if (!url) return false;
  return isDev ? url.startsWith(new URL(DEV_URL).origin) : url.startsWith("file://");
}

function configurePermissions() {
  const allowed = new Set(["media", "microphone", "audioCapture", "speaker-selection"]);
  const ses = session.defaultSession;

  // Grant microphone access to the app itself (voice chat); deny everything else.
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (details && (details.requestingUrl || details.securityOrigin)) || webContents.getURL();
    const isApp = isAppUrl(origin);
    const wantsVideo = details && Array.isArray(details.mediaTypes) && details.mediaTypes.includes("video");
    callback(isApp && allowed.has(permission) && !wantsVideo);
  });
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return allowed.has(permission) && (isAppUrl(requestingOrigin) || requestingOrigin === "null" || requestingOrigin === "");
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    title: "Genesis",
    backgroundColor: "#14120f",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in the user's browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL).catch((err) => {
      console.error(`[genesis] couldn't load ${DEV_URL}. Is the Vite dev server running? (${err.message})`);
    });
  } else if (fs.existsSync(DIST_INDEX)) {
    void mainWindow.loadFile(DIST_INDEX);
  } else {
    const msg = encodeURIComponent(
      `<body style="font-family:system-ui;background:#14120f;color:#f4ede3;padding:40px">` +
        `<h2>Genesis frontend isn't built yet</h2>` +
        `<p>Run <code>npm install && npm run build</code> in <code>genesis/frontend</code>, ` +
        `or start the dev server and use <code>npm run dev</code> here.</p></body>`,
    );
    void mainWindow.loadURL(`data:text/html;charset=utf-8,${msg}`);
  }
}

function onReady() {
  console.log(`[genesis] ${isDev ? "dev" : "production"} mode, origin ${appOrigin()}`);
  configurePermissions();
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBackend);
app.on("will-quit", stopBackend);
process.on("exit", stopBackend);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopBackend();
    app.quit();
  });
}
