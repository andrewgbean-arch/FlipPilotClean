// Run with: npx tsx src/utils/checks/routes.check.ts (from the app root).
// The app's screens are its files (Expo Router), so three mistakes are easy to make and silent on a type-check:
//   1. Two files with the SAME web address (the recurring "route-colliding duplicate files" bug): one shadows
//      the other. A tab file called marketplace.tsx would have collided with the real app/marketplace screen.
//   2. A file in app/(tabs) that the bottom bar's layout never declares: it shows up as a stray, unlabelled tab.
//      (Or a tab declared in the layout with no file behind it.)
//   3. The guided tour pointing at a screen that no longer exists (it pointed at /favourites after that tab
//      was moved into History).
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const APP = path.join(ROOT, "app");

let fail = 0;
const bad = (label: string, detail: string) => {
  fail++;
  console.log("FAIL", label, detail);
};

/** Every route file under app/, as { file, url }. Groups like (tabs) are not part of the address. */
function routeFiles(dir: string, prefix: string[] = []): { file: string; url: string }[] {
  const out: { file: string; url: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...routeFiles(full, [...prefix, entry.name]));
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
    const base = entry.name.replace(/\.(tsx|ts|jsx|js)$/, "");
    if (base.startsWith("_") || base.startsWith("+")) continue; // layouts, not-found, html
    const segments = [...prefix, base].filter((s) => !/^\(.*\)$/.test(s));
    if (segments[segments.length - 1] === "index") segments.pop();
    out.push({ file: path.relative(ROOT, full).split(path.sep).join("/"), url: "/" + segments.join("/") });
  }
  return out;
}

const routes = routeFiles(APP);

// 1. No two files share an address. (One exception: a tiny file whose whole job is a <Redirect>, such as
// app/scan/index.tsx sending /scan to the Scan tab, may share the address of the screen it points at.)
const isRedirectStub = (file: string) => {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  return text.includes("<Redirect") && text.split("\n").length < 15;
};
const byUrl = new Map<string, string[]>();
for (const r of routes) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), r.file]);
for (const [url, files] of byUrl) {
  const real = files.filter((f) => !isRedirectStub(f));
  if (files.length > 1 && real.length > 1) bad("two files share one address", `${url}: ${real.join(" and ")}`);
}

// 2. The bottom bar declares exactly the files that are in app/(tabs).
const tabsDir = path.join(APP, "(tabs)");
const tabFiles = fs
  .readdirSync(tabsDir)
  .filter((f) => /\.(tsx|ts)$/.test(f) && !f.startsWith("_"))
  .map((f) => f.replace(/\.(tsx|ts)$/, ""))
  .sort();
const layout = fs.readFileSync(path.join(tabsDir, "_layout.tsx"), "utf8");
const declared = [...layout.matchAll(/<Tabs\.Screen[^>]*?name="([^"]+)"/gs)].map((m) => m[1]).sort();
for (const f of tabFiles) if (!declared.includes(f)) bad("a file in (tabs) is not declared in the tab bar", f);
for (const d of declared) if (!tabFiles.includes(d)) bad("the tab bar declares a tab with no file", d);

// 3. Every screen the tour goes to exists.
const steps = fs.readFileSync(path.join(ROOT, "src", "features", "tour", "tourSteps.ts"), "utf8");
const tourScreens = [...steps.matchAll(/screen:\s*"([^"]+)"/g)].map((m) => m[1]);
if (tourScreens.length < 5) bad("could not read the tour's screens", String(tourScreens.length));
for (const screen of tourScreens) {
  if (!byUrl.has(screen)) bad("the tour goes to a screen that does not exist", screen);
}

// The tour's History step points at a target that History really registers.
const history = fs.readFileSync(path.join(tabsDir, "history.tsx"), "utf8");
for (const target of [...steps.matchAll(/targetId:\s*"(history\.[^"]+)"/g)].map((m) => m[1])) {
  if (!history.includes(`id="${target}"`)) bad("the tour points at a History target that is not there", target);
}

console.log(`${routes.length} route files, ${tabFiles.length} tabs, ${tourScreens.length} tour screens checked.`);
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
