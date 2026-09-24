import fs from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import { isProSubscriber } from "../subscriptions/revenueCat";

/* --------------------------------------------------
   Free tier: 5 AI lookups (barcode + photo combined) per calendar week, per
   device. Applied to /identify-barcode and /identify-image only — /price is
   step 2 of a scan already counted at step 1, not a second lookup.

   There's no login in this app, so "per device" is a self-generated id the
   client makes up and stores locally (src/utils/deviceId.ts) and sends with
   every scan. That id is NOT proof of identity — a determined user can clear
   it and get a fresh 5 — the same way any free tier without accounts works.
   It's a soft cap, not a security boundary.

   A device that has used its 5 gets one extra check before being blocked:
   is it actually a real, paying Pro subscriber? (see subscriptions/revenueCat.ts —
   a genuine server-to-server check, not a client-reported flag.) Bolt-on has
   no real product to check yet, so it isn't exempted here.
-------------------------------------------------- */

const WEEKLY_FREE_LIMIT = 5;

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

export async function freeScanLimit(req: Request, res: Response, next: NextFunction) {
  const deviceId =
    typeof req.query.deviceId === "string"
      ? req.query.deviceId
      : typeof req.body?.deviceId === "string"
      ? req.body.deviceId
      : null;

  // No device id means we can't tell whose count to add to, so it can't be let through:
  // leaving the field out would otherwise skip the cap. The app always sends it.
  if (!deviceId) {
    res.status(400).json({
      error: "missing-device",
      message: "Something went wrong identifying your phone. Please update the app and try again.",
    });
    return;
  }

  const weekStart = currentWeekStart();
  const store = load();
  const existing = store[deviceId];
  const record: DeviceRecord =
    existing?.weekStart === weekStart ? existing : { weekStart, count: 0 };

  if (record.count >= WEEKLY_FREE_LIMIT) {
    // Worth the extra round trip only once a device is actually about to be
    // blocked — a genuine Pro subscriber gets waved through with no cap.
    if (await isProSubscriber(deviceId)) return next();

    res.json({
      error: "free-scan-limit",
      message: "You've used your 5 free scans this week. Upgrade to Bolt-on or Pro for more.",
      resetsOn: nextWeekStart(weekStart),
    });
    return;
  }

  record.count += 1;
  store[deviceId] = record;
  save(store);

  next();
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

/** The cap as a route step: applies freeScanLimit when the cap is on, and does nothing when it is off. */
export function freeScanCap(req: Request, res: Response, next: NextFunction) {
  if (!freeScanCapEnabled()) return next();
  return freeScanLimit(req, res, next);
}
