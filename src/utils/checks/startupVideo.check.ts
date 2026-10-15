// Run with: npx tsx src/utils/checks/startupVideo.check.ts [colour] (from the app root).
// Found 2026-10-15 (owner): the startup video's background did not match the Home screen, so the screen visibly
// changed colour when the video handed over to Home. The video's background is baked into its pixels
// (scripts/recolour-startup-video.py made it exactly the Home background, #0A1128), and the native splash screen
// it follows is that colour too. If the theme's background is ever changed without making the video again, the
// mismatch comes back silently, so this fails the moment they drift apart.
// (An optional colour argument is the colour to expect instead, and STARTUP_CHECK_ROOT points the file checks at a
// copy of the app's files: that is how this check itself is tested.)
/// <reference types="node" />
// (This file runs under Node, not on a phone: the reference is what gives it Node's file functions without
// adding them to the whole app's type-check.)
import fs from "fs";
import path from "path";

import { themes } from "../../styles/theme";

const ROOT = process.env.STARTUP_CHECK_ROOT ?? path.resolve(__dirname, "..", "..", "..");
const VIDEO_BACKGROUND = (process.argv[2] ?? "#0A1128").toUpperCase();
const REGENERATE = "make the video again: python scripts/recolour-startup-video.py --help";

let fail = 0;
const bad = (label: string, detail: string) => {
  fail++;
  console.log("FAIL", label, detail);
};

// 1. Home's background (the free theme: the only one the app runs) is the colour the video was built for.
const home = themes.free.background.toUpperCase();
if (home !== VIDEO_BACKGROUND) {
  bad("the theme background is not the colour the startup video was built for", `${home} vs ${VIDEO_BACKGROUND}; ${REGENERATE}`);
}

// 2. The native splash screen, which the video follows, is that colour too.
const config = fs.readFileSync(path.join(ROOT, "app.config.js"), "utf8");
const splash = config.match(/"expo-splash-screen"[\s\S]*?backgroundColor:\s*"(#[0-9A-Fa-f]{6})"/);
if (!splash) {
  bad("could not read the splash screen's background colour from app.config.js", "");
} else if (splash[1].toUpperCase() !== VIDEO_BACKGROUND) {
  bad("the splash screen's background is not the startup video's colour", `${splash[1].toUpperCase()} vs ${VIDEO_BACKGROUND}`);
}

// 3. The startup screen itself paints the theme background around the video.
const intro = fs.readFileSync(path.join(ROOT, "app", "index.tsx"), "utf8");
if (!/styles\.container,\s*\{\s*backgroundColor:\s*theme\.background\s*\}/.test(intro)) {
  bad("the startup screen no longer paints theme.background", "app/index.tsx");
}

// 4. Nothing switches the app to the Pro theme (its background is darker, so the video would not match it).
const calls: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "checks") walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && /toggleTheme\(\)/.test(fs.readFileSync(full, "utf8"))) {
      calls.push(path.relative(ROOT, full).split(path.sep).join("/"));
    }
  }
};
walk(path.join(ROOT, "app"));
walk(path.join(ROOT, "src"));
if (calls.length) {
  bad("something switches the app to the Pro theme, whose background the startup video does not match", calls.join(", "));
}

console.log(`startup video colour ${VIDEO_BACKGROUND}: theme ${home}, splash ${splash ? splash[1].toUpperCase() : "?"}`);
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
