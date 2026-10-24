// Guards what the Android app asks Android for. Run before every release build:
//
//   npm run check:android
//
// It reads app.config.js the way Expo does and fails if a permission or service the app does not use has crept back in
// (the audio plugin adds the microphone and a media foreground service unless told not to, the Expo template adds a debug
// overlay permission, and the secure-store library brings in the fingerprint permissions). Google Play shows these to
// people and asks for a separate declaration for foreground services, so the list is kept to what FlipPilot really uses.
//
// The second half asks Expo for the manifest it would write (a few seconds) and checks the real result, not just the settings.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };

// ---- 1. the settings ----
const config = (await import(pathToFileURL(resolve(root, "app.config.js")).href)).default.expo;
const blocked = new Set(config.android.blockedPermissions ?? []);
for (const p of ["SYSTEM_ALERT_WINDOW", "ACCESS_FINE_LOCATION", "USE_BIOMETRIC", "USE_FINGERPRINT", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "RECORD_AUDIO"]) {
  need(blocked.has(`android.permission.${p}`), `${p} should be in android.blockedPermissions in app.config.js`);
}
const plugin = (name) => { const e = config.plugins.find((x) => (Array.isArray(x) ? x[0] : x) === name); return Array.isArray(e) ? e[1] ?? {} : e ? {} : null; };
const audio = plugin("expo-audio");
need(audio && audio.enableBackgroundPlayback === false && audio.enableBackgroundRecording === false && audio.recordAudioAndroid === false && audio.microphonePermission === false,
  "expo-audio must be set with enableBackgroundPlayback, enableBackgroundRecording, recordAudioAndroid and microphonePermission all false");
const video = plugin("expo-video");
need(video && video.supportsBackgroundPlayback === false, "expo-video must be set with supportsBackgroundPlayback: false");
const camera = plugin("expo-camera");
need(camera && camera.recordAudioAndroid === false && camera.microphonePermission === false, "expo-camera must be set with recordAudioAndroid and microphonePermission false");
const picker = plugin("expo-image-picker");
need(picker && picker.microphonePermission === false, "expo-image-picker must be set with microphonePermission: false");

// ---- 2. the manifest Expo would write ----
const out = execFileSync("npx", ["expo", "config", "--type", "introspect", "--json"], { cwd: root, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, EXPO_NO_TELEMETRY: "1" } });
const manifest = JSON.parse(out)._internal.modResults.android.manifest.manifest;
const kept = [...(manifest["uses-permission"] ?? []), ...(manifest["uses-permission-sdk-23"] ?? [])]
  .filter((p) => p.$["tools:node"] !== "remove")
  .map((p) => p.$["android:name"].replace("android.permission.", ""));
const ALLOWED = new Set(["ACCESS_COARSE_LOCATION", "CAMERA", "INTERNET", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "VIBRATE", "MODIFY_AUDIO_SETTINGS"]);
for (const p of kept) need(ALLOWED.has(p), `${p} is in the Android manifest but is not on the list of permissions FlipPilot uses (update ALLOWED in scripts/check-android-config.mjs only if the app now really needs it)`);
for (const p of ["ACCESS_COARSE_LOCATION", "CAMERA", "INTERNET"]) need(kept.includes(p), `${p} is missing from the Android manifest and the app needs it`);
const services = manifest.application[0].service ?? [];
need(services.length === 0, `the manifest declares services (${services.map((s) => s.$["android:name"]).join(", ")}): a foreground service needs its own Play declaration`);

if (problems.length) {
  console.error("Android config check FAILED:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log(`Android config check passed. Permissions the app asks for: ${kept.join(", ")}. Services: none.`);
