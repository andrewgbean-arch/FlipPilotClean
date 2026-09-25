import fs from "fs";
import path from "path";

/* --------------------------------------------------
   Free tier: 5 AI lookups (barcode + photo combined) per calendar week, per
   device. Applied to /identify-barcode and /identify-image only — /price is
   step 2 of a scan already counted at step 1, not a second lookup.

   There's no login in this app, so "per device" is a self-generated id the
   client makes up and stores locally (src/utils/deviceId.ts) and sends with
   every scan. That id is NOT proof of identity — a determined user can clear
   it and get a fresh 5 — the same way any free tier without accounts works.
   It's a soft cap, not a security boundary.

   What happens once a device has used its 5 (Pro check, scan credits, or a block) is decided in
   middleware/scanMeter.ts, which uses the helpers below.
-------------------------------------------------- */

export const WEEKLY_FREE_LIMIT = 5;

const FILE = path.join(__dirname, "../data/freeScans.json");

type DeviceRecord = { weekStart: string; count: number };
type Store = Record<string, DeviceRecord>;

function load(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(store: Store) {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

/** This device's counter, for a data export. */
export function freeScanRecordFor(deviceId: string): DeviceRecord | null {
  return load()[deviceId] ?? null;
}

/** Counters whose week ended long ago say nothing useful any more. */
export function purgeFreeScanRecords(olderThanDays: number, now = new Date()): number {
  const store = load();
  const cutoff = now.getTime() - olderThanDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [deviceId, record] of Object.entries(store)) {
    // The record covers a week starting at weekStart; it ended 7 days later.
    const ended = Date.parse(`${record.weekStart}T00:00:00Z`) + 7 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(ended) || ended < cutoff) {
      delete store[deviceId];
      removed++;
    }
  }
  if (removed > 0) save(store);
  return removed;
}

// Monday 00:00 UTC of the current week, as YYYY-MM-DD — a fixed reset point
// that doesn't depend on any device's own clock or timezone.
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const sinceMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday)
  );
  return monday.toISOString().slice(0, 10);
}

function nextWeekStart(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export type FreeScanStatus = { limit: number; used: number; left: number; resetsOn: string };

/** How many of this device's free scans are used this week. Changes nothing. */
export function freeScanStatus(deviceId: string): FreeScanStatus {
  const weekStart = currentWeekStart();
  const existing = load()[deviceId];
  const used = existing?.weekStart === weekStart ? existing.count : 0;
  return { limit: WEEKLY_FREE_LIMIT, used, left: Math.max(0, WEEKLY_FREE_LIMIT - used), resetsOn: nextWeekStart(weekStart) };
}

/** Uses one free scan if any are left this week. Returns whether one was used. */
export function takeFreeScan(deviceId: string): boolean {
  const weekStart = currentWeekStart();
  const store = load();
  const existing = store[deviceId];
  const record: DeviceRecord = existing?.weekStart === weekStart ? existing : { weekStart, count: 0 };
  if (record.count >= WEEKLY_FREE_LIMIT) return false;
  record.count += 1;
  store[deviceId] = record;
  save(store);
  return true;
}

/** Gives a free scan back when the scan it was used for failed. */
export function returnFreeScan(deviceId: string): void {
  const store = load();
  const record = store[deviceId];
  if (!record || record.weekStart !== currentWeekStart() || record.count < 1) return;
  record.count -= 1;
  save(store);
}

/**
 * Whether the free-scan cap applies. It is ON in production and OFF everywhere else, so real
 * users always have it and nobody testing the app on their own machine hits their own limit.
 * FREE_SCAN_CAP=on or off overrides either way.
 */
export function freeScanCapEnabled(): boolean {
  const setting = (process.env.FREE_SCAN_CAP ?? "").trim().toLowerCase();
  if (setting === "on") return true;
  if (setting === "off") return false;
  return process.env.NODE_ENV === "production";
}
