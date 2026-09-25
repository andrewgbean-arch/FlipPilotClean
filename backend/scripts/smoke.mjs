// A read-only check of a running FlipPilot backend: is it set up the way production should be?
//
//   node scripts/smoke.mjs https://your-backend.example.com [ADMIN_TOKEN]
//
// It only reads (GET), plus a few requests that a correctly set-up server must REFUSE. It never sends an
// email, never creates a listing or an account, and never spends anything (its probes are built so that even a
// wrongly set-up server makes nothing and calls no paid service). With the admin token it also
// looks at the cost report. Exit code 0 means nothing is wrong; 1 means at least one FAIL.

const base = (process.argv[2] ?? "").replace(/\/+$/, "");
const adminToken = process.argv[3] ?? "";
if (!/^https?:\/\//.test(base)) {
  console.log("Usage: node scripts/smoke.mjs https://your-backend.example.com [ADMIN_TOKEN]");
  process.exit(2);
}

let fails = 0, warns = 0, passes = 0;
const pass = (m) => { passes++; console.log(`  ok    ${m}`); };
const fail = (m, why = "") => { fails++; console.log(`  FAIL  ${m}${why ? `\n          ${why}` : ""}`); };
const warn = (m, why = "") => { warns++; console.log(`  warn  ${m}${why ? `\n          ${why}` : ""}`); };

async function call(method, path, { headers = {}, body } = {}) {
  try {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json, headers: res.headers };
  } catch (err) {
    return { status: 0, json: null, error: String(err?.message ?? err), headers: new Headers() };
  }
}

console.log(`\nChecking ${base}\n`);

/* ---------------- is it up, and over https ---------------- */
console.log("The basics");
const root = await call("GET", "/");
if (root.status === 200 && root.json?.ok) pass("the server answers");
else { fail("the server does not answer", root.error ?? `status ${root.status}`); console.log("\nNothing else can be checked.\n"); process.exit(1); }
if (base.startsWith("https://")) pass("it is reached over https");
else warn("it is not https", "Phones and the app stores need https. Use your host's https address.");

/* ---------------- the marketplace rules ---------------- */
console.log("\nThe marketplace rules");
const policy = await call("GET", "/marketplace/policy");
if (policy.status === 200 && policy.json?.carCreditCost === 25 && policy.json?.boostCreditCost > 0) pass("the rules page is there (car 25 credits, boost price set)");
else fail("the rules page is missing or old", "Is this the latest version of the backend?");
if (policy.json?.promoActive === true && !policy.json?.promoEndsAt) warn("the launch offer has no end date", "Set MARKETPLACE_PROMO_ENDS_AT, or listing stays free for ever.");
else if (policy.json?.promoEndsAt) pass(`the launch offer ends ${policy.json.promoEndsAt.slice(0, 10)}`);

const feed = await call("GET", "/published-listings");
if (feed.status === 200 && Array.isArray(feed.json)) pass(`the listing feed works (${feed.json.length} listings)`);
else fail("the listing feed does not work", `status ${feed.status}`);

for (const placement of ["scan", "feed", "messages"]) {
  const r = await call("GET", `/adverts?placement=${placement}`);
  if (r.status === 200) pass(`adverts answer for "${placement}"`);
  else fail(`adverts do not answer for "${placement}"`, `status ${r.status}`);
}

/* ---------------- accounts and scan limits are switched on ---------------- */
console.log("\nAccounts and limits (these must be ON in production)");
// No price is sent on purpose: a server that wrongly lets strangers sell answers 400 (missing price) and makes nothing.
const anon = await call("POST", "/create-listing", { body: { title: "smoke test", category: "other", deviceId: "smoke-test-not-a-real-phone" } });
if (anon.status === 401 && anon.json?.error === "sign-in-required") pass("selling needs a signed-in account");
else fail("selling does NOT need an account", `got status ${anon.status}. Check NODE_ENV=production (or REQUIRE_ACCOUNT=on).`);

const credits = await call("GET", "/credits?deviceId=smoke-test-not-a-real-phone");
if (credits.status === 200 && credits.json?.metering === true) pass("the free-scan limit and credits are ON");
else fail("the free-scan limit is OFF", "Check NODE_ENV=production (or FREE_SCAN_CAP=on). Without it everyone scans for free.");
if (Array.isArray(credits.json?.packs) && credits.json.packs.length === 4) pass("the four credit packs are listed");
else fail("the credit packs are not listed");

// A barcode too short to be one: a server that wrongly lets it through answers "bad barcode" without any paid lookup.
const scan = await call("GET", "/identify-barcode?q=12");
if (scan.status === 400 || scan.json?.error === "missing-device") pass("a scan with no phone id is refused");
else warn("a scan with no phone id was not refused", `status ${scan.status}`);

/* ---------------- things that must be closed ---------------- */
console.log("\nThings that must be closed to strangers");
const admin = await call("GET", "/admin/costs");
if (admin.status === 404) warn("the admin routes are switched off", "ADMIN_TOKEN is not set. You cannot approve adverts or read costs.");
else if (admin.status === 401 || admin.status === 403) pass("the admin routes refuse someone with no token");
else fail("the admin routes did not refuse a stranger", `status ${admin.status}`);

const hook = await call("POST", "/webhooks/revenuecat", { body: { event: { type: "TEST" } } });
if (hook.status === 401) pass("the refund webhook is on, and refuses anyone without the secret");
else if (hook.status === 404) warn("the refund webhook is not set up", "Set REVENUECAT_WEBHOOK_SECRET and add the webhook in RevenueCat, or a refunded pack keeps its credits.");
else fail("the refund webhook did not refuse a request with no secret", `status ${hook.status}`);

const bridge = await call("PUT", "/bridge/dealers/smoke/listings/smoke", { body: { title: "x", price: 1 } });
if (bridge.status === 404) pass("the Dealer OS link is off (fine until you need it)");
else if (bridge.status === 401) pass("the Dealer OS link is on and refuses anyone without the key");
else fail("the Dealer OS link did not refuse a stranger", `status ${bridge.status}`);

const upl = await call("GET", "/uploads/does-not-exist.jpg");
if (upl.status === 404 && upl.json?.ok === false) pass("a missing photo is a plain 404 (no file paths leaked)");
else warn("a missing photo did not give the plain 404", `status ${upl.status}`);

const helmet = root.headers.get("x-content-type-options");
if (helmet === "nosniff") pass("the standard security headers are on");
else warn("the standard security headers are missing");

/* ---------------- optional: with the admin token ---------------- */
if (adminToken) {
  console.log("\nWith your admin token");
  const costs = await call("GET", "/admin/costs?days=1", { headers: { "x-admin-token": adminToken } });
  if (costs.status === 200 && costs.json?.assumptions) pass("the cost report works");
  else fail("the admin token was not accepted", `status ${costs.status}`);
  const flagged = await call("GET", "/admin/adverts?needs=attention", { headers: { "x-admin-token": adminToken } });
  if (flagged.status === 200) pass("the advert admin works");
  else fail("the advert admin does not work", `status ${flagged.status}`);
}

console.log(`\n${passes} ok, ${warns} warnings, ${fails} failed\n`);
if (!adminToken) console.log("Tip: add your ADMIN_TOKEN as the second argument to check the admin routes too.\n");
process.exit(fails ? 1 : 0);
