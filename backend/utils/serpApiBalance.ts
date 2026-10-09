import axios from "axios";

/**
 * Keeps an eye on the SerpAPI search allowance (the Google Shopping lookups).
 *
 * Found 2026-10-05: the free plan's 250 searches ran out without anyone being told. Google prices
 * simply stopped arriving, and scans quietly fell back to eBay and the AI's guess. Two cheap
 * warnings now exist:
 *   1. the account's own balance (SerpAPI's account endpoint does not use up a search), checked at
 *      start-up and hourly, shown at GET /admin/costs and printed loudly in the logs when low;
 *   2. the moment a real search is refused for being out of searches, which is the most reliable
 *      signal of all (it is what actually happened to a customer's scan).
 * Nothing here ever prints or returns the key.
 */

export type SearchesLevel = "ok" | "low" | "out" | "unknown";

/** Below this share of the month's allowance left, the balance counts as low. */
export const LOW_SHARE = 0.2;

export function assessSearches(input: { left: unknown; perMonth?: unknown; used?: unknown }): SearchesLevel {
  const left = Number(input.left);
  if (input.left == null || input.left === "" || !Number.isFinite(left)) return "unknown";
  if (left <= 0) return "out";
  const perMonth = Number(input.perMonth);
  const used = Number(input.used);
  const allowance = Number.isFinite(perMonth) && perMonth > 0 ? perMonth : Number.isFinite(used) && used >= 0 ? left + used : null;
  if (allowance == null) return "ok";
  return left / allowance < LOW_SHARE ? "low" : "ok";
}

/** Whether an error from a SerpAPI search means the account has no searches left. */
export function isOutOfSearchesError(err: any): boolean {
  const status = err?.response?.status;
  const text = String(err?.response?.data?.error ?? err?.message ?? "");
  return status === 429 && /out of searches|run out/i.test(text);
}

export type SerpBalance = {
  level: SearchesLevel;
  plan: string | null;
  searchesLeft: number | null;
  usedThisMonth: number | null;
  perMonth: number | null;
  checkedAt: string;
};

const CHECK_EVERY_MS = 10 * 60 * 1000;
let cached: { at: number; value: SerpBalance } | null = null;

/** The account balance, asked for at most every 10 minutes. Null when there is no key or it can't be read. */
export async function serpApiBalance(now = Date.now()): Promise<SerpBalance | null> {
  if (!(process.env.SERPAPI_KEY ?? "").trim()) return null;
  if (cached && now - cached.at < CHECK_EVERY_MS) return cached.value;
  try {
    const res = await axios.get("https://serpapi.com/account.json", {
      params: { api_key: process.env.SERPAPI_KEY },
      timeout: 8000,
    });
    const d = res.data ?? {};
    const value: SerpBalance = {
      level: assessSearches({ left: d.total_searches_left, perMonth: d.searches_per_month, used: d.this_month_usage }),
      plan: typeof d.plan_name === "string" ? d.plan_name : null,
      searchesLeft: Number.isFinite(Number(d.total_searches_left)) ? Number(d.total_searches_left) : null,
      usedThisMonth: Number.isFinite(Number(d.this_month_usage)) ? Number(d.this_month_usage) : null,
      perMonth: Number.isFinite(Number(d.searches_per_month)) ? Number(d.searches_per_month) : null,
      checkedAt: new Date(now).toISOString(),
    };
    cached = { at: now, value };
    return value;
  } catch {
    return cached?.value ?? null;
  }
}

// The last time a real search was refused for being out of searches (cleared by the next success).
let refusedAt: number | null = null;
let lastShoutAt = 0;
const SHOUT_EVERY_MS = 60 * 60 * 1000;

export function noteSerpApiFailure(err: unknown, now = Date.now()) {
  if (!isOutOfSearchesError(err)) return;
  refusedAt = now;
  cached = null; // look at the real balance next time it is asked for
  if (now - lastShoutAt >= SHOUT_EVERY_MS) {
    lastShoutAt = now;
    console.error(
      "⛔ SERPAPI OUT OF SEARCHES: Google Shopping prices are not being fetched, so scans are falling back to eBay and the AI's estimate. Upgrade the SerpAPI plan or wait for the monthly reset."
    );
  }
}

export function noteSerpApiSuccess() {
  refusedAt = null;
}

export function serpApiRefusal(): { refusedAt: string | null } {
  return { refusedAt: refusedAt == null ? null : new Date(refusedAt).toISOString() };
}

/** Prints the balance now, and again every hour while it is not fine. Never blocks start-up. */
export function watchSerpApiBalance(): void {
  const look = async () => {
    const b = await serpApiBalance(Date.now());
    if (!b) return;
    if (b.level === "out") console.error(`⛔ SerpAPI: no searches left on the ${b.plan ?? "current"} plan. Google prices will not load until it is upgraded or resets.`);
    else if (b.level === "low") console.warn(`⚠️  SerpAPI: only ${b.searchesLeft} searches left this month (${b.plan ?? "plan"}).`);
  };
  void look();
  setInterval(look, 60 * 60 * 1000).unref();
}

export function clearSerpApiStateForTests() {
  cached = null;
  refusedAt = null;
  lastShoutAt = 0;
}
