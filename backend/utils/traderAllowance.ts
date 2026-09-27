import fs from "fs";
import path from "path";
import { dataPath } from "../config/dataDir";

/**
 * The Trader plan's monthly scans (see middleware/scanMeter.ts).
 *
 * A Trader subscriber gets TRADER_MONTHLY_SCANS lookups in each billing period, on top of the free
 * weekly ones. Not "unlimited": every lookup costs us real money (an AI read and usually a Google
 * search), and one very heavy user on an unlimited plan could cost more than the plan brings in.
 *
 * Counted per phone (the id RevenueCat knows the subscriber by) and per billing period: the period is
 * named by the date RevenueCat gives for the subscription's latest payment, so the count starts again
 * by itself when the plan renews. Only the phone id, the period and a number are kept, nothing about
 * what was scanned. Like the free weekly counter it is not wiped by "delete my data": that would
 * hand out a fresh month of scans.
 */

export const TRADER_MONTHLY_SCANS = Math.max(1, Math.floor(Number(process.env.TRADER_MONTHLY_SCANS) || 300));

const FILE = dataPath("traderScans.json");

type Row = { period: string; used: number };
type Store = Record<string, Row>;

function load(): Store {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    // A corrupt file must never be replaced by an empty one: that would hand everyone a fresh month.
    throw new Error("traderScans.json could not be read");
  }
}

function save(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, FILE);
}

/** How many of this period's Trader scans are used. A new period starts at zero. */
function usedIn(store: Store, deviceId: string, period: string): number {
  const row = store[deviceId];
  return row && row.period === period ? row.used : 0;
}

export function traderScansLeft(deviceId: string, period: string): number {
  return Math.max(0, TRADER_MONTHLY_SCANS - usedIn(load(), deviceId, period));
}

/** Takes one of this period's scans. False when they are all used (the scan then falls back to credits). */
export function takeTraderScan(deviceId: string, period: string): boolean {
  const store = load();
  const used = usedIn(store, deviceId, period);
  if (used >= TRADER_MONTHLY_SCANS) return false;
  store[deviceId] = { period, used: used + 1 };
  save(store);
  return true;
}

/** Gives a scan back when the lookup failed, so a scan with no answer never uses the allowance. */
export function returnTraderScan(deviceId: string, period: string): void {
  const store = load();
  const row = store[deviceId];
  // A renewal in between means the scan belonged to a period that is already over: nothing to give back.
  if (!row || row.period !== period || row.used <= 0) return;
  row.used -= 1;
  save(store);
}

/** This phone's counter, for a data export. */
export function traderScanRecordFor(deviceId: string): Row | null {
  return load()[deviceId] ?? null;
}
