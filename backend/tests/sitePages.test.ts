import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import helmet from "helmet";
import registerSitePages, { SITE_TOKENS, fillTokens } from "../routes/sitePages";
import registerAdvertisePages from "../routes/advertisePages";
import { accountGuard } from "../middleware/accountGuard";
import { RETENTION } from "../config/retention";
import { MONTHLY_FREE_LIMIT } from "../middleware/freeScanLimit";
import { PRO_DAILY_SCANS } from "../utils/proAllowance";
import { CODE_TTL_MS } from "../utils/accountStore";

// flippilot.co.uk's own pages: home, Privacy Policy, Terms and account deletion. What these tests
// protect is that what the pages SAY stays true: the numbers are the server's own, every link goes
// somewhere, nothing is loaded from another company, and the policy names every outside service
// the code talks to.

const BACKEND = path.resolve(__dirname, "..");
const SITE = path.join(BACKEND, "public", "site");
const BROWSER = { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

const PAGES = [
  { path: "/", file: "index.html", h1: "Buy and sell second-hand with your eyes open." },
  { path: "/privacy", file: "privacy.html", h1: "Privacy Policy" },
  { path: "/terms", file: "terms.html", h1: "Terms of Use" },
  { path: "/delete-account", file: "delete-account.html", h1: "Delete your FlipPilot account" },
];

let server: http.Server;
let base = "";

before(async () => {
  // The same order as server.ts: security headers, the server's "cache nothing" rule, who-is-asking, then the pages, then the health check.
  const app = express();
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    next();
  });
  app.use(accountGuard);
  registerAdvertisePages(app);
  registerSitePages(app);
  app.get("/", (_req, res) => {
    res.status(200).json({ ok: true, message: "FlipPilot backend running" });
  });
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => {
  server?.close();
});

async function get(p: string, headers: Record<string, string> = BROWSER) {
  const res = await fetch(base + p, { headers });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

/** A request sent exactly as written, so "/../" and "%2e%2e" reach the server unchanged. */
function raw(p: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    http
      .get({ host: url.hostname, port: url.port, path: p, headers }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const pageText = async (p: string) => text((await get(p)).body);
const idsIn = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/**
 * Checks a page says something, with the message written out. A bare assert.ok(x.includes(...)) that fails
 * makes Node work the message out from the source file, which under tsx can stall the whole run for minutes.
 */
function says(haystack: string, phrase: string, where: string) {
  assert.ok(haystack.includes(phrase), `${where} should say: ${phrase}`);
}

/* ------------------------------ the pages ------------------------------ */

describe("each page", () => {
  for (const p of PAGES) {
    test(`${p.path} loads, has its heading and no unfilled blanks`, async () => {
      const r = await get(p.path);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type") ?? "", /^text\/html; charset=utf-8/i);
      assert.match(r.body, /<html lang="en-GB">/);
      assert.match(r.body, /<meta name="viewport"/);
      assert.match(r.body, /<title>[^<]*FlipPilot[^<]*<\/title>/);
      assert.equal((r.body.match(/<h1>/g) ?? []).length, 1);
      assert.ok(r.body.includes(`<h1>${p.h1}</h1>`), `${p.path} is missing its heading "${p.h1}"`);
      assert.doesNotMatch(r.body, /\{\{|\}\}/, "an unfilled {{token}}");
      assert.doesNotMatch(r.body, /\[[^\]]*(to be added|to be confirmed|tbc|todo|insert|placeholder|your name)[^\]]*\]/i, "a [placeholder]");
      assert.doesNotMatch(r.body, /lorem ipsum|TODO|FIXME/i);
    });
  }

  test("a trailing slash and a HEAD request work too", async () => {
    for (const p of ["/privacy/", "/terms/", "/delete-account/"]) assert.equal((await get(p)).status, 200, p);
    const head = await fetch(base + "/privacy", { method: "HEAD", headers: BROWSER });
    assert.equal(head.status, 200);
  });

  test("a page that doesn't exist is a 404, not the home page", async () => {
    assert.equal((await get("/privacy/extra")).status, 404);
    assert.equal((await get("/cookies")).status, 404);
  });
});

/* ------------------------------ the numbers ------------------------------ */

describe("the numbers on the pages", () => {
  test("every {{token}} in the files is a number the server knows", () => {
    for (const p of PAGES) {
      const html = fs.readFileSync(path.join(SITE, p.file), "utf8");
      for (const m of html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        assert.ok(m[1] in SITE_TOKENS, `${p.file} uses {{${m[1]}}}, which isn't in SITE_TOKENS`);
      }
    }
  });

  test("every number is used as a token, not typed into a page by hand", () => {
    const used = new Set<string>();
    for (const p of PAGES) {
      const html = fs.readFileSync(path.join(SITE, p.file), "utf8");
      for (const m of html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) used.add(m[1]);
    }
    for (const key of Object.keys(SITE_TOKENS)) {
      assert.ok(used.has(key), `{{${key}}} isn't used by any page, so a number may have been typed in where it belongs`);
    }
    // And a changed setting shows up: with every number swapped for a marker, each marker turns up on a page.
    const saved = { ...SITE_TOKENS };
    try {
      Object.keys(SITE_TOKENS).forEach((k, i) => (SITE_TOKENS[k] = 7000 + i));
      const all = PAGES.map((p) => fillTokens(fs.readFileSync(path.join(SITE, p.file), "utf8"), p.file)).join("\n");
      Object.keys(SITE_TOKENS).forEach((k, i) => assert.ok(all.includes(String(7000 + i)), `changing ${k} changes nothing on the pages`));
    } finally {
      Object.assign(SITE_TOKENS, saved);
    }
  });

  test("an unknown token is refused, not published", () => {
    assert.throws(() => fillTokens("Kept for {{nonsense}} months", "x.html"), /x\.html uses \{\{nonsense\}\}/);
    assert.equal(fillTokens("{{reportMonths}} and {{ reportMonths }}"), `${RETENTION.reportMonths} and ${RETENTION.reportMonths}`);
  });

  test("the tokens stand for the real settings", () => {
    assert.equal(SITE_TOKENS.freeScans, MONTHLY_FREE_LIMIT);
    assert.equal(SITE_TOKENS.proDailyScans, PRO_DAILY_SCANS);
    assert.equal(SITE_TOKENS.listingDays, RETENTION.listingDays);
    assert.equal(SITE_TOKENS.graceDays, RETENTION.expiredListingGraceDays);
    assert.equal(SITE_TOKENS.soldMonths, RETENTION.soldListingMonths);
    assert.equal(SITE_TOKENS.messagesMonths, RETENTION.messagesMonthsAfterLastMessage);
    assert.equal(SITE_TOKENS.fairDays, RETENTION.fairDaysAfterDate);
    assert.equal(SITE_TOKENS.reportMonths, RETENTION.reportMonths);
    assert.equal(SITE_TOKENS.freeScanDays, RETENTION.freeScanDaysAfterWeek);
    assert.equal(SITE_TOKENS.inactiveSellerMonths, RETENTION.inactiveSellerMonths);
    assert.equal(SITE_TOKENS.inactiveAccountMonths, RETENTION.inactiveAccountMonths);
    assert.equal(SITE_TOKENS.paymentRecordYears, RETENTION.paymentRecordYears);
  });

  test("the Privacy Policy states the periods the clean-up job really uses", async () => {
    const t = await pageText("/privacy");
    says(t, `${RETENTION.inactiveAccountMonths} months after you last signed in or used the app`, "/privacy");
    says(t, `kept for ${RETENTION.paymentRecordYears} years as a business record`, "/privacy");
    says(t, `A report someone else made about you or your listing is kept for the same time`, "/privacy");
    says(t, `${RETENTION.freeScanDaysAfterWeek} days after the period it counts has ended`, "/privacy");
    says(t, `A listing is live for ${RETENTION.listingDays} days`, "/privacy");
    says(t, `another ${RETENTION.expiredListingGraceDays} days so you can relist it`, "/privacy");
    says(t, `A sold listing is deleted ${RETENTION.soldListingMonths} months after`, "/privacy");
    says(t, `${RETENTION.inactiveSellerMonths} months after your last activity`, "/privacy");
    says(t, `${RETENTION.messagesMonthsAfterLastMessage} months after the last message`, "/privacy");
    says(t, `A report is kept for ${RETENTION.reportMonths} months`, "/privacy");
    says(t, `${RETENTION.fairDaysAfterDate} days after the event's date`, "/privacy");
    says(t, `${MONTHLY_FREE_LIMIT} scans a month for each account`, "/privacy");
  });

  test("the sign-in code time it states is the real one", async () => {
    const t = await pageText("/privacy");
    assert.ok(t.includes(`A code works for ${CODE_TTL_MS / 60_000} minutes`), "CODE_TTL_MS and the policy disagree");
  });

  test("Terms and the deletion page state the same numbers", async () => {
    const terms = await pageText("/terms");
    says(terms, `every account gets ${MONTHLY_FREE_LIMIT} free scans each calendar month`, "/terms");
    says(terms, `up to ${PRO_DAILY_SCANS} scans a day`, "/terms");
    says(terms, `A car listing lasts ${RETENTION.listingDays} days`, "/terms");
    says(terms, "A scan that fails with an error isn't counted against your allowance", "/terms");
    says(terms, "the highest mileage recorded at any of its MOT tests", "/terms");
    const del = await pageText("/delete-account");
    says(del, `kept for ${RETENTION.reportMonths} months`, "/delete-account");
    says(del, `For ${RETENTION.paymentRecordYears} years we keep only the business name`, "/delete-account");
    says(del, `for ${RETENTION.inactiveAccountMonths} months is deleted automatically`, "/delete-account");
    const home = await pageText("/");
    says(home, `get ${MONTHLY_FREE_LIMIT} scans a month`, "/");
  });
});

/* ------------------------------ links and loading ------------------------------ */

describe("links", () => {
  test("every link on every page goes somewhere that exists, and every #section it names is there", async () => {
    for (const p of PAGES) {
      const html = (await get(p.path)).body;
      for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)) {
        const href = m[1];
        if (href.startsWith("mailto:") || /^https:\/\//.test(href)) continue;
        assert.doesNotMatch(href, /^(http:|javascript:|data:)/, `${p.path} links to ${href}`);
        const [target, fragment] = href.split("#");
        const dest = target === "" ? p.path : target;
        const r = await get(dest);
        assert.equal(r.status, 200, `${p.path} links to ${href}, which gives ${r.status}`);
        if (fragment) assert.ok(idsIn(r.body).has(fragment), `${p.path} links to ${href}, but ${dest} has no id="${fragment}"`);
      }
    }
  });

  test("the only other websites linked are the regulator's and our own main site, and only as ordinary links", async () => {
    const outside = new Set<string>();
    for (const p of PAGES) {
      const html = (await get(p.path)).body;
      for (const m of html.matchAll(/<a\b[^>]*?\shref="(https:\/\/[^"]+)"/g)) outside.add(new URL(m[1]).hostname);
    }
    // flippilot.co.uk is our own main website (Dealer OS and the app), not another company's.
    assert.deepEqual([...outside].sort(), ["flippilot.co.uk", "ico.org.uk"]);
  });

  test("the only email address on the pages is support@flippilot.co.uk, and no home address is published", async () => {
    for (const p of PAGES) {
      const html = (await get(p.path)).body;
      for (const m of html.matchAll(/mailto:([^"?]+)/g)) assert.equal(m[1], "support@flippilot.co.uk", p.path);
      const emails = (text(html).match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).map((e) => e.replace(/\.+$/, ""));
      for (const e of emails) assert.equal(e, "support@flippilot.co.uk", `${p.path} shows ${e}`);
      assert.doesNotMatch(html, /Paignton|Dartmouth|TQ4\s?5/i, `${p.path} shows the owner's home address`);
    }
  });
});

describe("what loads", () => {
  test("the pages load nothing from another company and run no scripts", async () => {
    for (const p of PAGES) {
      const html = (await get(p.path)).body;
      assert.doesNotMatch(html, /<script|<iframe|<form|<object|<embed|<video|<audio|<source|<style|\sstyle=|\son\w+=/i, `${p.path} uses something the policy says it doesn't`);
      for (const m of html.matchAll(/<(link|img)\b[^>]*?\s(?:href|src)="([^"]+)"/g)) {
        assert.ok(m[2].startsWith("/") && !m[2].startsWith("//"), `${p.path} loads ${m[2]} from outside`);
      }
    }
    const css = (await get("/site-assets/site.css")).body;
    assert.doesNotMatch(css, /@import|@font-face|https?:\/\//i);
  });

  test("no page or file sets a cookie", async () => {
    for (const p of [...PAGES.map((x) => x.path), "/site-assets/site.css", "/site-assets/app-icon.png", "/site-assets/favicon.png", "/favicon.ico"]) {
      assert.equal((await get(p)).headers.get("set-cookie"), null, p);
    }
  });
});

describe("the files", () => {
  test("stylesheet and pictures come back with the right type", async () => {
    const css = await get("/site-assets/site.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") ?? "", /^text\/css/);
    for (const f of ["/site-assets/app-icon.png", "/site-assets/favicon.png", "/favicon.ico"]) {
      const r = await get(f);
      assert.equal(r.status, 200, f);
      assert.equal(r.headers.get("content-type"), "image/png", f);
    }
  });

  test("the page templates can't be fetched raw, by any route", async () => {
    for (const p of [
      "/privacy.html",
      "/site/privacy.html",
      "/site-assets/privacy.html",
      "/site-assets/../privacy.html",
      "/site-assets/%2e%2e/privacy.html",
      "/site-assets/..%2fprivacy.html",
      "/site-assets/%2e%2e%2f%2e%2e%2fserver.ts",
      "/site-assets/../../package.json",
      "/site-assets/",
    ]) {
      const r = await raw(p, BROWSER);
      assert.notEqual(r.status, 200, `${p} was served`);
      assert.doesNotMatch(r.body, /\{\{|"name": "flippilot-backend"/, p);
    }
  });
});

/* ------------------------------ the health check ------------------------------ */

describe("the address / (the host's health check)", () => {
  test("anything that is not asking for a page still gets the health reply", async () => {
    const plain = await get("/", { accept: "*/*" });
    assert.equal(plain.status, 200);
    assert.equal(JSON.parse(plain.body).ok, true);
    assert.equal(JSON.parse((await get("/", { accept: "application/json" })).body).ok, true);
    // A client that sends no Accept header at all.
    assert.equal(JSON.parse((await raw("/")).body).ok, true);
    // Node's own fetch, with its default headers.
    assert.equal(JSON.parse(await (await fetch(base + "/")).text()).ok, true);
  });

  test("a browser gets the home page", async () => {
    const r = await get("/", BROWSER);
    assert.match(r.headers.get("content-type") ?? "", /^text\/html/);
    says(r.body, "<h1>Buy and sell second-hand with your eyes open.</h1>", "/");
    assert.match((await get("/", { accept: "text/html" })).headers.get("content-type") ?? "", /^text\/html/);
  });

  test("server.ts registers the pages before its health check", () => {
    const src = fs.readFileSync(path.join(BACKEND, "server.ts"), "utf8");
    const pages = src.indexOf("registerSitePages(app)");
    const health = src.indexOf('app.get("/"');
    assert.ok(pages > 0 && health > 0, "couldn't find them");
    assert.ok(pages < health, "the health check would answer a browser before the home page can");
  });
});

/* ------------------------------ what the pages say ------------------------------ */

describe("what the pages say matches the product", () => {
  test("each legal page says who runs FlipPilot and how to reach them", async () => {
    for (const p of ["/privacy", "/terms", "/delete-account"]) {
      const t = await pageText(p);
      says(t, "Andrew Bean, trading as FlipPilot", p);
      says(t, "support@flippilot.co.uk", p);
    }
  });

  test("the deletion page gives the steps the app really has, and says what is kept", async () => {
    const t = await pageText("/delete-account");
    for (const w of ["Settings", "Account", "Delete my account", "Your data", "Download my data", "Delete my data", "within one month", "does not cancel your subscription", "Google Play"]) {
      assert.ok(t.includes(w), `the deletion page doesn't mention "${w}"`);
    }
    for (const w of ["Reports you made", "fingerprint", "Backups"]) assert.ok(t.includes(w), `the deletion page doesn't say it keeps: ${w}`);
  });

  test("the buttons the pages tell people to tap are still in the app", (t) => {
    const settings = path.join(BACKEND, "..", "src", "features", "settings", "index.tsx");
    if (!fs.existsSync(settings)) return t.skip("the app's source isn't beside the backend here");
    const src = fs.readFileSync(settings, "utf8");
    for (const title of ["Delete my account", "Download my data", "Delete my data"]) {
      assert.ok(src.includes(`title="${title}"`), `the app no longer has a "${title}" row, but the pages tell people to tap it`);
    }
    for (const section of ["Account", "Your data"]) {
      assert.ok(src.includes(`<SectionTitle>${section}</SectionTitle>`), `the app no longer has a "${section}" section`);
    }
  });

  test("the photo promise is backed by the code: the policy says it, and only the cleaning step writes into the uploads folder", async () => {
    says(await pageText("/privacy"), "When you upload a photo we remove the hidden details your phone saves inside it", "/privacy");

    const skip = new Set(["node_modules", "dist", "tests", "public", "data", "scripts"]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(BACKEND);
    const store = path.join(BACKEND, "utils", "uploadStore.ts");
    const writers = files.filter((f) => f !== store && /(writeFileSync|copyFileSync|renameSync|createWriteStream|writeFile)\([^)]*(UPLOADS_DIR|uploads)/.test(fs.readFileSync(f, "utf8")));
    assert.deepEqual(writers.map((f) => path.relative(BACKEND, f)), [], "something other than uploadStore writes photos, so they may skip the cleaning");

    const src = fs.readFileSync(store, "utf8");
    const cleaned = src.indexOf("stripImageMetadata(buffer, ext)");
    const written = src.indexOf("fs.writeFileSync(path.join(UPLOADS_DIR, name), clean)");
    assert.ok(cleaned > 0, "saveUpload no longer cleans a photo");
    assert.ok(written > cleaned, "saveUpload must write the cleaned photo, after cleaning it, never the bytes as they came");
  });

  test("the advertiser terms name who runs FlipPilot and link to the Privacy Policy", async () => {
    const r = await get("/advertise/terms");
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.body, /\[business name/i);
    says(r.body, "Andrew Bean, trading as FlipPilot", "/advertise/terms");
    says(r.body, 'href="/privacy"', "/advertise/terms");
  });

  test("the Privacy Policy names every outside service the server talks to", async () => {
    // [where its address ends] -> [what the policy has to call it]
    const SERVICES: Array<[RegExp, string[]]> = [
      [/(^|\.)ebay\.(com|co\.uk)$/, ["eBay"]],
      [/(^|\.)serpapi\.com$/, ["SerpApi"]],
      [/(^|\.)openai\.com$/, ["OpenAI"]],
      [/(^|\.)openfoodfacts\.org$/, ["Open Food Facts"]],
      [/(^|\.)api\.gov\.uk$/, ["DVLA", "DVSA"]],
      [/(^|\.)revenuecat\.com$/, ["RevenueCat"]],
      [/(^|\.)stripe\.com$/, ["Stripe"]],
      [/(^|\.)postcodes\.io$/, ["postcodes.io"]],
      [/(^|\.)resend\.com$/, ["Resend"]],
      [/(^|\.)(googleapis|gstatic)\.com$/, ["Google Fonts"]],
    ];
    // Addresses in the code that are not a service handling anyone's information.
    const NOT_SERVICES = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org)|yourbusiness\.co\.uk)$/;

    const skip = new Set(["node_modules", "dist", "tests", "public", "data", "scripts"]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(BACKEND);
    assert.ok(files.length > 20, "found hardly any server files");

    const hosts = new Set<string>();
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) hosts.add(m[1].toLowerCase());
    }
    assert.ok(hosts.has("api.openai.com") && hosts.has("api.resend.com"), "the scan for addresses isn't finding the ones it should");

    const policy = await pageText("/privacy");
    for (const host of hosts) {
      if (NOT_SERVICES.test(host)) continue;
      const hit = SERVICES.find(([re]) => re.test(host));
      assert.ok(hit, `The server talks to ${host}, which the Privacy Policy doesn't cover. Add the service to privacy.html (section 4), then to SERVICES here.`);
      for (const name of hit[1]) assert.ok(policy.includes(name), `The server talks to ${host}, but the Privacy Policy never mentions ${name}`);
    }
  });
});
