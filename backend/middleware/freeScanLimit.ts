import fs from "fs";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/* --------------------------------------------------
   Free tier: AI lookups (barcode + photo combined) per calendar month. Applied to
   /identify-barcode and /identify-image only — /price is step 2 of a scan already
   counted at step 1, not a second lookup.

   Changed 22 Oct 2026 (owner's decision): FlipPilot is free to use, and you sign up (an email address and
   a one-time code, no password) to scan.

     - Signed in: MONTHLY_FREE_LIMIT (100) a month, counted per ACCOUNT, whatever device id the request
       names. An account needs an email address that can receive a sign-in code, which a script cannot make
       up for free. That is also why signing up is required: a device id is NOT proof of identity (it is a
       self-generated string anyone can clear, or a script can send afresh with every request), so a free
       allowance per device was unlimited in practice (found 2026-10-05). With the Google search gone from the
       free scans a lookup costs well under a penny, but the whole server still shares one daily lookup budget
       and eBay's own daily call limit, and one script could use them up and show "busy" to everybody.
     - Not signed in: no free scans. ANONYMOUS_SCANS=on (a setting on the server, off by default) gives a
       phone ANONYMOUS_FREE_LIMIT (10) a month with a weekly cap on the whole network address as well: a lever
       for testing before sign-in emails reach everyone, not how the app is meant to run.

   After the free scans: the Pro plan (unlimited, with a fair-use ceiling a day), then any scan credits an
   account still holds, then a refusal. That is decided in middleware/scanMeter.ts, which uses the helpers below.
-------------------------------------------------- */

/** Free scans a month for a signed-in account. Settable on the server (FREE_SCANS_PER_MONTH) without a code change. */
export const MONTHLY_FREE_LIMIT = Math.max(1, Math.floor(Number(process.env.FREE_SCANS_PER_MONTH) || 100));
/** Free scans a month for a phone that is not signed in, when ANONYMOUS_SCANS is on. */
export const ANONYMOUS_FREE_LIMIT = 10;

/**
 * Free scans a WEEK for ALL the phones not signed in behind one network address (only used when ANONYMOUS_SCANS is on).
 * This is the limit a script can't get round by making up device ids: it cannot make up its address. Generous on
 * purpose (a household, an office, a boot fair's wifi, a mobile network that shares one address between many people);
 * when it is used up the answer is "sign in", which is free and is what we want people to do anyway.
 */
export const ANONYMOUS_FREE_PER_ADDRESS = 30;

/** Whether a phone that is not signed in may scan at all. Off unless ANONYMOUS_SCANS=on (or 1/true/yes). */
export function anonymousScansAllowed(): boolean {
  const v = (process.env.ANONYMOUS_SCANS ?? "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true" || v === "yes";
}

/** The counter an account's free scans are kept under (device ids are kept under their own text). */
export const accountFreeKey = (accountId: string) => `acct:${accountId}`;

/**
 * Whose free scans a request uses up, and how many that is a month: the account when signed in
 * (whatever device id it names), otherwise the device (none at all, unless anonymous scans are switched on).
 */
export function freeScanSubject(deviceId: string, account?: { id: string } | null): { key: string; limit: number } {
  return account
    ? { key: accountFreeKey(account.id), limit: MONTHLY_FREE_LIMIT }
    : { key: deviceId, limit: anonymousScansAllowed() ? ANONYMOUS_FREE_LIMIT : 0 };
}

const FILE = dataPath("freeScans.json");

// `periodStart` is the first day of the month the count belongs to. Records written before 22 Oct 2026 are
// weekly and carry `weekStart` instead: they match no month, so they simply start again at zero.
type DeviceRecord = { periodStart?: string; weekStart?: string; count: number };
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the period a counter covers ended. */
function periodEnd(record: DeviceRecord): number {
  if (record.periodStart) return Date.parse(`${nextPeriodStart(record.periodStart)}T00:00:00Z`);
  return Date.parse(`${record.weekStart}T00:00:00Z`) + 7 * DAY_MS;
}

/** Counters whose period ended long ago say nothing useful any more. */
export function purgeFreeScanRecords(olderThanDays: number, now = new Date()): number {
  const store = load();
  const cutoff = now.getTime() - olderThanDays * DAY_MS;
  let removed = 0;
  for (const [deviceId, record] of Object.entries(store)) {
    const ended = periodEnd(record);
    if (!Number.isFinite(ended) || ended < cutoff) {
      delete store[deviceId];
      removed++;
    }
  }
  if (removed > 0) save(store);
  return removed;
}

// The first day of the current month (UTC), as YYYY-MM-DD — a fixed reset point that doesn't depend
// on any device's own clock or timezone.
function currentPeriodStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function nextPeriodStart(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

// Monday 00:00 UTC of the current week, as YYYY-MM-DD. Only the per-address counters below still work in weeks.
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const sinceMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday)
  );
  return monday.toISOString().slice(0, 10);
}

export type FreeScanStatus = { limit: number; used: number; left: number; resetsOn: string };

/** How many free scans this counter (a device id, or an account's key) has used this month. Changes nothing. */
export function freeScanStatus(key: string, limit: number = MONTHLY_FREE_LIMIT): FreeScanStatus {
  const periodStart = currentPeriodStart();
  const existing = load()[key];
  const used = existing?.periodStart === periodStart ? existing.count : 0;
  return { limit, used, left: Math.max(0, limit - used), resetsOn: nextPeriodStart(periodStart) };
}

/** Uses one free scan if any are left this month. Returns whether one was used. */
export function takeFreeScan(key: string, limit: number = MONTHLY_FREE_LIMIT): boolean {
  const periodStart = currentPeriodStart();
  const store = load();
  const existing = store[key];
  const record: DeviceRecord = existing?.periodStart === periodStart ? existing : { periodStart, count: 0 };
  if (record.count >= limit) return false;
  record.count += 1;
  store[key] = record;
  save(store);
  return true;
}

/** "1 November": a reset date in words, for a message. */
export function resetDateInWords(resetsOn: string): string {
  const d = new Date(`${resetsOn}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? resetsOn : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
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
  if (!record || record.periodStart !== currentPeriodStart() || record.count < 1) return;
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
