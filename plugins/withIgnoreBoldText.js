// An Expo config plugin that makes the Android app ignore the phone's "Bold text" setting (Android 12 and later).
//
// Why: React Native works out how wide and how tall a piece of text is using the normal font weight, but the phone's own
// text view then draws plain text (text with no font weight of its own) with a heavier font when Bold text is on. The
// heavier letters no longer fit the space that was measured, so the last letter of a short label ("Back" shows as "Bac")
// or the last word of a sentence wraps onto a line that is cut off. Seen on a Samsung S22, and reproduced on the Android
// emulator with `settings put secure font_weight_adjustment 300`. Telling the main screen that the phone's text weight is
// normal makes measuring and drawing agree again, for every piece of text in the app, including sentences that wrap.
//
// What it costs: plain text no longer gets heavier on a phone with Bold text on. Text that already has a font weight
// (headings, buttons) was never affected either way, and the phone's font SIZE setting still works.
//
// One limit (tested on the emulator, 29 Oct 2026): it applies every time the app starts. If someone switches Bold text
// on while the app is already open, Android restarts the screen inside the running app and the cut-off comes back until
// the app is closed and opened again, which is no worse than before this plugin. Switching it off while open is fine.
//
// It adds one method to MainActivity.kt each time Expo writes the Android project (so EAS builds get it too). If a new
// Expo version changes the shape of that file, this stops the build with a clear message instead of quietly dropping
// the fix. `npm run check:boldoverride` tests it.
const { withMainActivity } = require("expo/config-plugins");

// Written into the Kotlin file, so a second run (Expo can write over a project that already has it) adds nothing.
const MARKER = "ignore-system-bold-text";

const IMPORTS = ["android.content.Context", "android.content.res.Configuration", "android.os.Build"];

const METHOD = [
  "  // " + MARKER + ": added by plugins/withIgnoreBoldText.js. On Android 12+ a phone with Bold text on draws plain text",
  "  // heavier than React Native measured it, which cuts off the last letter or word. Telling this screen that the",
  "  // phone's text weight is normal makes measuring and drawing agree (see the plugin for the full story).",
  "  override fun attachBaseContext(newBase: Context) {",
  "    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {",
  "      val config = Configuration(newBase.resources.configuration)",
  "      config.fontWeightAdjustment = 0",
  "      super.attachBaseContext(newBase.createConfigurationContext(config))",
  "    } else {",
  "      super.attachBaseContext(newBase)",
  "    }",
  "  }",
  "",
];

/** Returns the text of MainActivity.kt with the method and the imports it needs added (once). */
function addIgnoreBoldOverride(source) {
  if (source.includes(MARKER)) return source;

  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const classLine = /^class MainActivity\s*:\s*ReactActivity\(\)\s*\{[ \t]*\r?\n/m;
  if (!classLine.test(source)) {
    throw new Error(
      "withIgnoreBoldText: could not find the line 'class MainActivity : ReactActivity() {' in MainActivity.kt. " +
        "The Expo template has changed: update plugins/withIgnoreBoldText.js, or Bold text will cut text off again."
    );
  }
  let out = source.replace(classLine, (line) => line + METHOD.join(eol) + eol);

  const missing = IMPORTS.filter((name) => !new RegExp("^import " + name.replace(/\./g, "\\.") + "[ \\t]*\\r?$", "m").test(out));
  if (missing.length > 0) {
    const packageLine = /^package .*\r?\n/m;
    if (!packageLine.test(out)) {
      throw new Error("withIgnoreBoldText: could not find the 'package' line in MainActivity.kt to add the imports after.");
    }
    out = out.replace(packageLine, (line) => line + missing.map((name) => "import " + name + eol).join(""));
  }
  return out;
}

function withIgnoreBoldText(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") {
      throw new Error("withIgnoreBoldText: expected MainActivity to be Kotlin, but it is " + mod.modResults.language + ".");
    }
    mod.modResults.contents = addIgnoreBoldOverride(mod.modResults.contents);
    return mod;
  });
}

module.exports = withIgnoreBoldText;
module.exports.addIgnoreBoldOverride = addIgnoreBoldOverride;
module.exports.MARKER = MARKER;
