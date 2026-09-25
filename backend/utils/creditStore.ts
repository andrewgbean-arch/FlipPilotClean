import fs from "fs";
import path from "path";
import { dataPath } from "../config/dataDir";

/**
 * Scan credits. One balance per ACCOUNT (not per phone), so credits follow a person to a new phone
 * and can't be lost by reinstalling.
 *
 * Every change goes through this file and is synchronous, so two requests can never spend the same
 * credit: the balance is checked and reduced in one step. A scan spends its credit when it starts
 * and gives it back if the scan then fails (see middleware/scanMeter.ts).
 *
 * Each account keeps a short history so a dispute ("I was charged for a scan that failed") can be
 * looked at. Purchases and gifts are always kept; the many small scan entries are trimmed to the
 * latest ones. Nothing about WHAT was scanned is stored, only that a scan happened.
 */

const FILE = dataPath("credits.json");

export type CreditEntry = { at: string; delta: number; reason: string; ref?: string; /** The app store's own id for the purchase, so a refund can be matched to it. */ txn?: string };
type Row = { balance: number; granted: number; spent: number; updatedAt: string; ledger: CreditEntry[] };
type Store = Record<string, Row>;

/** How many scan-sized entries are kept per account. Purchases and gifts are never trimmed. */
const MAX_USAGE_ENTRIES = 100;
/** The most one grant may add: a guard against a typo, not a business limit. */
export const MAX_GRANT = 100_000;

const isGrant = (e: CreditEntry) => e.delta > 0 && e.reason !== "scan-refund" && e.reason !== "refund";

function load(): Store {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    // A corrupt file must never be replaced by an empty one: that would wipe everyone's balance.
    throw new Error("credits.json could not be read");
  }
}

function save(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, FILE);
}

function rowOf(store: Store, accountId: string): Row {
  return (store[accountId] ??= { balance: 0, granted: 0, spent: 0, updatedAt: new Date().toISOString(), ledger: [] });
}

function record(row: Row, entry: CreditEntry) {
  row.ledger.push(entry);
  row.updatedAt = entry.at;
  const usage = row.ledger.filter((e) => !isGrant(e));
  if (usage.length > MAX_USAGE_ENTRIES) {
    const drop = new Set(usage.slice(0, usage.length - MAX_USAGE_ENTRIES));
    row.ledger = row.ledger.filter((e) => !drop.has(e));
  }
}

const whole = (n: unknown): number | null => (typeof n === "number" && Number.isInteger(n) && n >= 1 ? n : null);

/** What the person can spend. Never below zero: a refund after credits were used leaves a debt that the next purchase pays off first. */
export function getBalance(accountId: string): number {
  return Math.max(0, load()[accountId]?.balance ?? 0);
}

/** Takes credits if there are enough. Never lets the balance go below zero. */
export function spend(accountId: string, amount: number, reason: string): { ok: boolean; balance: number } {
  const n = whole(amount);
  const store = load();
  const row = store[accountId];
  if (!n || !row || row.balance < n) return { ok: false, balance: Math.max(0, row?.balance ?? 0) };
  row.balance -= n;
  row.spent += n;
  record(row, { at: new Date().toISOString(), delta: -n, reason });
  save(store);
  return { ok: true, balance: row.balance };
}

/** Gives credits back after something that was paid for did not happen. */
export function refund(accountId: string, amount: number, reason = "scan-refund"): number {
  const n = whole(amount);
  const store = load();
  const row = store[accountId];
  if (!n || !row) return row?.balance ?? 0;
  row.balance += n;
  row.spent = Math.max(0, row.spent - n);
  record(row, { at: new Date().toISOString(), delta: n, reason });
  save(store);
  return row.balance;
}

/**
 * Adds credits from a purchase or a gift. A grant with a `ref` (for example the store's transaction id)
 * is only ever applied once, so a purchase that is reported twice does not pay out twice.
 */
export function grant(
  accountId: string,
  amount: number,
  reason: "purchase" | "gift",
  ref?: string,
  txn?: string
): { ok: boolean; balance: number; duplicate?: boolean } {
  const n = whole(amount);
  if (!n || n > MAX_GRANT) return { ok: false, balance: getBalance(accountId) };
  const store = load();
  const row = rowOf(store, accountId);
  if (ref && row.ledger.some((e) => isGrant(e) && e.ref === ref)) return { ok: true, balance: row.balance, duplicate: true };
  row.balance += n;
  row.granted += n;
  record(row, { at: new Date().toISOString(), delta: n, reason, ...(ref ? { ref } : {}), ...(txn ? { txn } : {}) });
  save(store);
  return { ok: true, balance: Math.max(0, row.balance) };
}

/* ------------------------------------------------------------------
   Refunds. When an app store refunds a credit pack, RevenueCat tells us (routes/webhooks.ts) and the
   credits it paid for are taken back. The store's transaction id of every refunded purchase is kept, so
   a purchase that was refunded BEFORE its credits were claimed can never be claimed afterwards.
------------------------------------------------------------------ */

const REFUNDS_FILE = dataPath("creditRefunds.json");
type Refunds = Record<string, { at: string; accountId: string | null; credits: number }>;
const MAX_REFUNDS_KEPT = 5000;

function loadRefunds(): Refunds {
  if (!fs.existsSync(REFUNDS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(REFUNDS_FILE, "utf8"));
  } catch {
    throw new Error("creditRefunds.json could not be read");
  }
}

function saveRefunds(refunds: Refunds) {
  // The newest are kept: a refund notice only ever arrives within days of the purchase.
  const keys = Object.keys(refunds);
  if (keys.length > MAX_REFUNDS_KEPT) {
    keys.sort((a, b) => Date.parse(refunds[a].at) - Date.parse(refunds[b].at));
    for (const k of keys.slice(0, keys.length - MAX_REFUNDS_KEPT)) delete refunds[k];
  }
  fs.mkdirSync(path.dirname(REFUNDS_FILE), { recursive: true });
  const tmp = `${REFUNDS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(refunds, null, 2));
  fs.renameSync(tmp, REFUNDS_FILE);
}

export function isRefunded(txn: string | undefined): boolean {
  return !!txn && txn in loadRefunds();
}

/**
 * Takes back the credits a refunded purchase paid for. `credits` is what a pack of that product gives, used
 * when the purchase was never claimed (so there is no ledger entry to read the amount from). Safe to call
 * twice: the second time changes nothing. The balance may go below zero if the credits were already spent;
 * it is never shown below zero, and the next purchase pays that off first.
 */
export function reverseRefundedPurchase(
  txn: string,
  accountId: string | null,
  credits: number
): { status: "reversed" | "duplicate" | "unclaimed"; taken: number } {
  const refunds = loadRefunds();
  if (txn in refunds) return { status: "duplicate", taken: 0 };

  let taken = 0;
  if (accountId) {
    const store = load();
    const row = store[accountId];
    const granted = row?.ledger.find((e) => isGrant(e) && e.txn === txn);
    if (row && granted) {
      taken = granted.delta;
      row.balance -= taken;
      row.granted = Math.max(0, row.granted - taken);
      record(row, { at: new Date().toISOString(), delta: -taken, reason: "purchase-refunded", ref: `refund:${txn}` });
      save(store);
    }
  }
  refunds[txn] = { at: new Date().toISOString(), accountId, credits: taken || credits };
  saveRefunds(refunds);
  return { status: taken > 0 ? "reversed" : "unclaimed", taken };
}

/** What we hold for this account, for the person's own data export and for support. */
export function creditsFor(accountId: string): Row | null {
  return load()[accountId] ?? null;
}

/** Deleting an account forfeits any credits left; the record goes with it. */
export function deleteAccountCredits(accountId: string): boolean {
  const store = load();
  if (!(accountId in store)) return false;
  delete store[accountId];
  save(store);
  return true;
}
