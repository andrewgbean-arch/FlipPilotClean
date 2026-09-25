import fs from "fs";
import path from "path";
import { dataPath } from "../config/dataDir";

/**
 * What the paid services cost us, worked out from what we really call.
 *
 * Every call to OpenAI, SerpAPI and eBay is counted here as it happens (OpenAI with the tokens it
 * says it used), added up per day, and turned into an ESTIMATED cost with the prices below. It
 * records only what kind of call it was and how big: never who made it, what was scanned, or any
 * photo. Read it at GET /admin/costs.
 *
 * The prices are the published ones and can be changed in the environment without touching code:
 *   OPENAI_INPUT_USD_PER_M   dollars per million input tokens   (default 0.15,  gpt-4o-mini)
 *   OPENAI_OUTPUT_USD_PER_M  dollars per million output tokens  (default 0.60,  gpt-4o-mini)
 *   SERPAPI_USD_PER_SEARCH   dollars per Google search          (default 0.015, depends on your plan)
 *   USD_TO_GBP               exchange rate for the pounds shown (default 0.75)
 * eBay's Browse API is free (within its daily limit), so it is counted but costs nothing here.
 */

const FILE = dataPath("costs.json");
const KEEP_DAYS = 90;
const FLUSH_MS = 5000;

export type CostService = "openai" | "serpapi" | "ebay";
export type ScanKind = "barcode" | "photo";

type DayRow = {
  /** calls[service][purpose] = how many times */
  calls: Record<string, Record<string, number>>;
  inputTokens: number;
  outputTokens: number;
  /** Calls that failed or timed out (a failed call can still be charged). */
  failed: number;
  /** Lookups that ended with a result for the person. */
  scans: Record<ScanKind, number>;
};
type Store = { days: Record<string, DayRow> };

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && v !== undefined && v !== "" ? n : fallback;
};
const prices = () => ({
  inUsdPerM: num(process.env.OPENAI_INPUT_USD_PER_M, 0.15),
  outUsdPerM: num(process.env.OPENAI_OUTPUT_USD_PER_M, 0.6),
  searchUsd: num(process.env.SERPAPI_USD_PER_SEARCH, 0.015),
  gbp: num(process.env.USD_TO_GBP, 0.75),
});

let store: Store | null = null;
let dirty = false;
let timer: NodeJS.Timeout | null = null;

const today = () => new Date().toISOString().slice(0, 10);
const emptyDay = (): DayRow => ({ calls: {}, inputTokens: 0, outputTokens: 0, failed: 0, scans: { barcode: 0, photo: 0 } });

function load(): Store {
  if (store) return store;
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!store || typeof store.days !== "object") store = { days: {} };
  } catch {
    store = { days: {} };
  }
  return store!;
}

export function flushCosts() {
  if (!dirty || !store) return;
  try {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const day of Object.keys(store.days)) if (day < cutoff) delete store.days[day];
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (err: any) {
    console.log("cost log could not be saved:", err?.message);
  }
}

function touch(): DayRow {
  const s = load();
  const row = (s.days[today()] ??= emptyDay());
  dirty = true;
  // Written every few seconds rather than on every call, so counting is never a slowdown.
  if (!timer) {
    timer = setInterval(flushCosts, FLUSH_MS);
    timer.unref();
    process.once("beforeExit", flushCosts);
  }
  return row;
}

/** OpenAI reports its usage in one of two shapes (chat completions and the newer responses API). */
export function openAiUsage(data: any): { inputTokens: number; outputTokens: number } {
  const u = data?.usage ?? {};
  return {
    inputTokens: Number(u.input_tokens ?? u.prompt_tokens) || 0,
    outputTokens: Number(u.output_tokens ?? u.completion_tokens) || 0,
  };
}

/** Counts one paid call. `purpose` says what it was for, for example "photo-identify" or "google-shopping". */
export function recordCost(service: CostService, purpose: string, extra: { inputTokens?: number; outputTokens?: number; failed?: boolean } = {}) {
  const row = touch();
  const byPurpose = (row.calls[service] ??= {});
  byPurpose[purpose] = (byPurpose[purpose] ?? 0) + 1;
  row.inputTokens += extra.inputTokens ?? 0;
  row.outputTokens += extra.outputTokens ?? 0;
  if (extra.failed) row.failed += 1;
}

/** Counts a lookup that ended with a result for the person, so cost per scan can be worked out. */
export function recordScan(kind: ScanKind) {
  touch().scans[kind] += 1;
}

const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

/** The estimated cost of one day's row, in US dollars, by service. */
function costOf(row: DayRow) {
  const p = prices();
  const openai = (row.inputTokens / 1e6) * p.inUsdPerM + (row.outputTokens / 1e6) * p.outUsdPerM;
  const serpapi = sum(row.calls.serpapi) * p.searchUsd;
  return { openai, serpapi, total: openai + serpapi };
}

const pence = (usd: number) => Math.round(usd * prices().gbp * 10000) / 100;

/** The last `days` days, newest first, with estimated costs in pence. */
export function costReport(days = 7) {
  const s = load();
  const keys = Object.keys(s.days).sort().reverse().slice(0, Math.max(1, Math.min(days, KEEP_DAYS)));
  const rows = keys.map((day) => {
    const row = s.days[day];
    const cost = costOf(row);
    const scans = row.scans.barcode + row.scans.photo;
    return {
      day,
      scans,
      scansByKind: row.scans,
      calls: row.calls,
      failedCalls: row.failed,
      tokens: { input: row.inputTokens, output: row.outputTokens },
      estimatedPence: { openai: pence(cost.openai), serpapi: pence(cost.serpapi), total: pence(cost.total) },
      // Only meaningful once there are scans; includes every paid call made that day.
      estimatedPencePerScan: scans ? Math.round((pence(cost.total) / scans) * 100) / 100 : null,
    };
  });
  const totalPence = rows.reduce((a, r) => a + r.estimatedPence.total, 0);
  const totalScans = rows.reduce((a, r) => a + r.scans, 0);
  return {
    days: rows,
    total: {
      scans: totalScans,
      estimatedPence: Math.round(totalPence * 100) / 100,
      estimatedPencePerScan: totalScans ? Math.round((totalPence / totalScans) * 100) / 100 : null,
    },
    assumptions: { ...prices(), note: "Estimates from published prices; check them against the real bills." },
  };
}

/** For tests: forget everything in memory (the file is left alone). */
export function resetCostLogForTests() {
  store = { days: {} };
  dirty = false;
}
