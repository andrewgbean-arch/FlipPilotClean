import fs from "fs";
import path from "path";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/* --------------------------------------------------
   Free tier: AI lookups (barcode + photo combined) per calendar week. Applied to
   /identify-barcode and /identify-image only — /price is step 2 of a scan already
   counted at step 1, not a second lookup.

   Two tiers, because a device id is NOT proof of identity: it is a self-generated
   id the client makes up (src/utils/deviceId.ts) and anyone can clear it, or a
   script can send a new one with every request, for a fresh allowance each time.
   Found 2026-10-05 while testing: with made-up ids, "5 free scans per device" was
   unlimited, and the whole server shares one daily lookup budget, so one script
   could use it all up and show "busy" to everybody.

     - Not signed in: ANONYMOUS_FREE_LIMIT (2) a week, counted per device. A taste,
       and still a soft cap on its own.
     - Signed in: WEEKLY_FREE_LIMIT (5) a week, counted per ACCOUNT, whatever device
       id the request names. An account needs an email address that can receive a
       sign-in code, which a script cannot make up for free.

   What happens once a device has used its 5 (Pro check, scan credits, or a block) is decided in
   middleware/scanMeter.ts, which uses the helpers below.
-------------------------------------------------- */

/** Free scans a week for a signed-in account. */
export const WEEKLY_FREE_LIMIT = 5;
/** Free scans a week for a phone that is not signed in. */
export const ANONYMOUS_FREE_LIMIT = 2;

/**
 * Free scans a week for ALL the phones not signed in behind one network address. This is the limit a script
 * can't get round by making up device ids: it cannot make up its address. Generous on purpose (a household,
 * an office, a boot fair's wifi, a mobile network that shares one address between many people); when it is
 * used up the answer is "sign in", which is free and is what we want people to do anyway.
 */
export const ANONYMOUS_FREE_PER_ADDRESS = 30;

/** The counter an account's free scans are kept under (device ids are kept under their own text). */
export const accountFreeKey = (accountId: string) => `acct:${accountId}`;

/**
 * Whose free scans a request uses up, and how many that is a week: the account when signed in
 * (whatever device id it names), otherwise the device.
 */
export function freeScanSubject(deviceId: string, account?: { id: string } | null): { key: string; limit: number } {
  return account ? { key: accountFreeKey(account.id), limit: WEEKLY_FREE_LIMIT } : { key: deviceId, limit: ANONYMOUS_FREE_LIMIT };
}

const FILE = dataPath("freeScans.json");

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
  writeJsonAtomic(FILE, store);
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

/** How many free scans this counter (a device id, or an account's key) has used this week. Changes nothing. */
export function freeScanStatus(key: string, limit: number = WEEKLY_FREE_LIMIT): FreeScanStatus {
  const weekStart = currentWeekStart();
  const existing = load()[key];
  const used = existing?.weekStart === weekStart ? existing.count : 0;
  return { limit, used, left: Math.max(0, limit - used), resetsOn: nextWeekStart(weekStart) };
}

/** Uses one free scan if any are left this week. Returns whether one was used. */
export function takeFreeScan(key: string, limit: number = WEEKLY_FREE_LIMIT): boolean {
  const weekStart = currentWeekStart();
  const store = load();
  const existing = store[key];
  const record: DeviceRecord = existing?.weekStart === weekStart ? existing : { weekStart, count: 0 };
  if (record.count >= limit) return false;
  record.count += 1;
  store[key] = record;
  save(store);
  return true;
}

/* ---- per network address (anonymous scans only) ----
   Kept in memory only, like the rate limiter's counters: no address is written to disk, so there is
   nothing to export, erase or keep. A restart forgets it, which can only give a few extra free scans. */
const addressUse = new Map<string, { weekStart: string; count: number }>();

function addressRecord(ip: string, weekStart: string) {
  const existing = addressUse.get(ip);
  return existing && existing.weekStart === weekStart ? existing : { weekStart, count: 0 };
}

/** How many more anonymous scans this address may make this week. Changes nothing. No address: no limit. */
export function addressScansLeft(ip: string | null | undefined): number {
  if (!ip) return ANONYMOUS_FREE_PER_ADDRESS;
  return Math.max(0, ANONYMOUS_FREE_PER_ADDRESS - addressRecord(ip, currentWeekStart()).count);
}

/** Uses one of the address's anonymous scans if any are left. With no address to go by, nothing is limited. */
export function takeAddressScan(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const weekStart = currentWeekStart();
  const record = addressRecord(ip, weekStart);
  if (record.count >= ANONYMOUS_FREE_PER_ADDRESS) return false;
  record.count += 1;
  if (addressUse.size >= 20_000) {
    for (const [key, r] of addressUse) if (r.weekStart !== weekStart) addressUse.delete(key);
  }
  addressUse.set(ip, record);
  return true;
}

/** Gives an address's anonymous scan back when the scan it was used for failed. */
export function returnAddressScan(ip: string | null | undefined): void {
  if (!ip) return;
  const record = addressUse.get(ip);
  if (!record || record.weekStart !== currentWeekStart() || record.count < 1) return;
  record.count -= 1;
}

export function clearAddressScansForTests() {
  addressUse.clear();
}

/** Forgets a counter, for when the account it belongs to is deleted. */
export function deleteFreeScanRecord(key: string): boolean {
  const store = load();
  if (!(key in store)) return false;
  delete store[key];
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
