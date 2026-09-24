// Preload runs with contextIsolation on and nodeIntegration off: expose only a tiny,
// read-only description of the desktop environment to the web app.
"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("genesisDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
