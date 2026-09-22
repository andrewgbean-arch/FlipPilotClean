import fs from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";

/* --------------------------------------------------
   Free tier: 5 AI lookups (barcode + photo combined) per calendar week, per
   device. Applied to /identify-barcode and /identify-image only — /price is
   step 2 of a scan already counted at step 1, not a second lookup.

   There's no login in this app, so "per device" is a self-generated id the
   client makes up and stores locally (src/utils/deviceId.ts) and sends with
   every scan. That id is NOT proof of identity — a determined user can clear
   it and get a fresh 5 — the same way any free tier without accounts works.
   It's a soft cap, not a security boundary.

   Bolt-on and Pro aren't purchasable through the app yet (see
   app/upgrade.tsx), so for now this cap applies to every device regardless
   of subscription status. Exempting real subscribers needs a server-side
   RevenueCat check (their app-user-id, verified against RevenueCat's REST
   API with a secret key) — a client-reported "I'm Pro" flag would be trivial
   to fake, the same class of bug fixed in rateLimit.ts's userId removal.
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

export function freeScanLimit(req: Request, res: Response, next: NextFunction) {
  const deviceId =
    typeof req.query.deviceId === "string"
      ? req.query.deviceId
      : typeof req.body?.deviceId === "string"
      ? req.body.deviceId
      : null;

  // No device id sent (an older app build, or a direct API call) — let it
  // through rather than block a legitimate request over one missing field.
  if (!deviceId) return next();

  const weekStart = currentWeekStart();
  const store = load();
  const existing = store[deviceId];
  const record: DeviceRecord =
    existing?.weekStart === weekStart ? existing : { weekStart, count: 0 };

  if (record.count >= WEEKLY_FREE_LIMIT) {
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
