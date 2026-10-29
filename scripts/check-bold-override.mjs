// Run with: npm run check:boldoverride (from the app root). Exits 1 if it finds a problem.
//
// The Android app ignores the phone's "Bold text" setting so that no text is cut off (the reason is written at the top of
// plugins/withIgnoreBoldText.js). That only works if the plugin is listed in the app's settings AND still knows how to
// write itself into the Android project, so this checks both: the plugin is in the list, and run on a copy of Expo's
// MainActivity.kt it adds the method and its imports, adds nothing the second time, works with either kind of line ending,
// and stops with an error (rather than quietly doing nothing) when the file no longer looks like Expo's.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };

// ---- 1. listed in the app's settings ----
const configJs = resolve(root, "app.config.js");
const expo = existsSync(configJs)
  ? (await import(pathToFileURL(configJs).href)).default.expo
  : JSON.parse(readFileSync(resolve(root, "app.json"), "utf8")).expo;
const listed = (expo.plugins ?? []).some((p) => (Array.isArray(p) ? p[0] : p) === "./plugins/withIgnoreBoldText");
need(listed, 'the plugins list in the app settings must include "./plugins/withIgnoreBoldText" (see plugins/withIgnoreBoldText.js for why)');

// ---- 2. what it does to Expo's MainActivity.kt ----
const { addIgnoreBoldOverride, MARKER } = require(resolve(root, "plugins", "withIgnoreBoldText.js"));
const TEMPLATE = [
  "package com.example.app",
  "import expo.modules.splashscreen.SplashScreenManager",
  "",
  "import android.os.Build",
  "import android.os.Bundle",
  "",
  "import com.facebook.react.ReactActivity",
  "",
  "class MainActivity : ReactActivity() {",
  "  override fun onCreate(savedInstanceState: Bundle?) {",
  "    super.onCreate(null)",
  "  }",
  "}",
  "",
];
for (const [name, eol] of [["with Unix line endings", "\n"], ["with Windows line endings", "\r\n"]]) {
  const sample = TEMPLATE.join(eol);
  let once;
  try {
    once = addIgnoreBoldOverride(sample);
  } catch (err) {
    need(false, `the plugin stopped on a normal Expo MainActivity.kt ${name}: ${err.message}`);
    continue;
  }
  need(once.includes("override fun attachBaseContext(newBase: Context)") && once.includes("fontWeightAdjustment = 0") && once.includes(MARKER), `the method is not added ${name}`);
  need(/^import android\.content\.Context\r?$/m.test(once) && /^import android\.content\.res\.Configuration\r?$/m.test(once), `its imports are not added ${name}`);
  need((once.match(/^import android\.os\.Build\r?$/gm) ?? []).length === 1, `android.os.Build must be imported exactly once ${name}`);
  need(once.indexOf("attachBaseContext") < once.indexOf("override fun onCreate"), `the method should sit at the top of the class ${name}`);
  need(addIgnoreBoldOverride(once) === once, `running it a second time must change nothing ${name}`);
  need(once.replace(/\r?\n/g, "\n").includes("super.attachBaseContext(newBase)"), `the older-Android branch is missing ${name}`);
}
// A file with a package line (so only the class-line safety net can stop it) whose class is not the one Expo writes.
for (const [what, text] of [
  ["a different class", "package com.example.app\n\nclass SomethingElse {\n}\n"],
  ["a different base class", "package com.example.app\n\nclass MainActivity : AppCompatActivity() {\n}\n"],
]) {
  let stopped = false;
  try { addIgnoreBoldOverride(text); } catch { stopped = true; }
  need(stopped, `when MainActivity.kt has ${what}, the plugin must stop the build with an error, not carry on`);
}
// And one with no package line at all, where the imports have nowhere to go.
{
  let stopped = false;
  try { addIgnoreBoldOverride("class MainActivity : ReactActivity() {\n}\n"); } catch { stopped = true; }
  need(stopped, "when MainActivity.kt has no package line, the plugin must stop the build with an error, not carry on");
}

if (problems.length) {
  console.error("Bold text override check FAILED:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("check:boldoverride OK: the plugin is listed and writes the Android override correctly.");
