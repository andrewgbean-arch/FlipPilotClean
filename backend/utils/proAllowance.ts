import fs from "fs";
import path from "path";
import { dataPath } from "../config/dataDir";

/**
 * The Pro plan's fair-use ceiling (see middleware/scanMeter.ts).
 *
 * Pro (4.99 pounds a month) is unlimited scans. "Unlimited" still needs a ceiling a day: eBay lets the whole app
 * make only so many calls a day (every scan uses one or two of them), so one account scanning in a loop could use
 * up everyone's share. PRO_DAILY_SCANS (150 unless the server says otherwise) is far more than a person scanning
 * by hand gets through in a day, a car boot morning included.
 *
 * Counted per phone (the id RevenueCat knows the subscriber by) and per UTC day, so the count starts again by itself
 * each day. Only the phone id, the day and a number are kept, nothing about what was scanned. Like the free
 * monthly counter it is not wiped by "delete my data": that would hand out a fresh day of scans.
 *
 * Replaces utils/traderAllowance.ts (the old Trader plan's 300 scans a month, 22 Oct 2026).
 */

export const PRO_DAILY_SCANS = Math.max(1, Math.floor(Number(process.env.PRO_DAILY_SCANS) || 150));

const FILE = dataPath("proScans.json");

type Row = { day: string; used: number };
type Store = Record<string, Row>;

/** Today, in UTC, as YYYY-MM-DD. */
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

function load(): Store {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    // A corrupt file must never be replaced by an empty one: that would hand everyone a fresh day.
    throw new Error("proScans.json could not be read");
  }
}

function save(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, FILE);
}

/** How many of this day's scans are used. A new day starts at zero. */
function usedOn(store: Store, deviceId: string, day: string): number {
  const row = store[deviceId];
  return row && row.day === day ? row.used : 0;
}

export function proScansLeft(deviceId: string, day: string = utcDay()): number {
  return Math.max(0, PRO_DAILY_SCANS - usedOn(load(), deviceId, day));
}

/** Takes one of today's scans. False when they are all used (the scan then falls back to credits, if any). */
export function takeProScan(deviceId: string, day: string = utcDay()): boolean {
  const store = load();
  const used = usedOn(store, deviceId, day);
  if (used >= PRO_DAILY_SCANS) return false;
  store[deviceId] = { day, used: used + 1 };
  save(store);
  return true;
}

/** Gives a scan back when the lookup failed, so a scan with no answer never uses the allowance. */
export function returnProScan(deviceId: string, day: string = utcDay()): void {
  const store = load();
  const row = store[deviceId];
  // Midnight in between means the scan belonged to a day that is already over: nothing to give back.
  if (!row || row.day !== day || row.used <= 0) return;
  row.used -= 1;
  save(store);
}

/** This phone's counter, for a data export. */
export function proScanRecordFor(deviceId: string): Row | null {
  return load()[deviceId] ?? null;
}
