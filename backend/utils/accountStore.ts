import crypto from "crypto";
import fs from "fs";
import path from "path";
import { deleteAccountCredits } from "./creditStore";

/**
 * Accounts: an email address proved by a one-time code, and a durable identity
 * that survives reinstalling the app.
 *
 * How identity works. Everything in the app (listings, messages, reviews, limits)
 * is keyed on a "device id". An account OWNS one such id, its canonical id. When
 * someone signs in on a new phone, the phone adopts that id, so everything they
 * had is theirs again, and a scammer can no longer shed a bad reputation by
 * reinstalling: they would need a fresh verified email address each time.
 *
 * Once an id belongs to an account, a request naming it must carry that account's
 * session token (see middleware/accountGuard.ts), so knowing the id alone is no
 * longer enough to act as that person.
 *
 * Nothing secret is kept in the clear: codes are stored salted and hashed, and
 * session tokens are stored only as hashes.
 */

const DIR = path.join(__dirname, "../data");
const ACCOUNTS_PATH = path.join(DIR, "accounts.json");
const CODES_PATH = path.join(DIR, "authCodes.json");
const SESSIONS_PATH = path.join(DIR, "sessions.json");

export const CODE_TTL_MS = Number(process.env.AUTH_CODE_TTL_MS) > 0 ? Number(process.env.AUTH_CODE_TTL_MS) : 10 * 60_000;
const MAX_WRONG_TRIES = 5;
const RESEND_GAP_MS = Number(process.env.AUTH_RESEND_GAP_MS) >= 0 && process.env.AUTH_RESEND_GAP_MS !== undefined ? Number(process.env.AUTH_RESEND_GAP_MS) : 30_000;
const MAX_CODES_PER_HOUR = 5;
const SESSION_DAYS = 90;
const MAX_SESSIONS = 10;

export type Account = {
  id: string;
  email: string;
  /** The device id this account owns; a phone that signs in adopts it. */
  canonicalDeviceId: string;
  createdAt: string;
  lastLoginAt: string;
};
type LoginCode = { email: string; codeHash: string; salt: string; expiresAt: number; attempts: number; sends: number[] };
type Session = { tokenHash: string; accountId: string; createdAt: string; lastUsedAt: string; expiresAt: number };

/* ------------------------------ storage ------------------------------ */

/** Write to a temporary file and rename it over the real one, so a crash can't leave half a file. */
function writeJsonAtomic(file: string, data: unknown) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    // A corrupt file must not be silently replaced by an empty one (that would sign everyone out).
    throw new Error(`${path.basename(file)} could not be read`);
  }
}

// The account list is read on every request (to know whose ids are protected), so it is kept in
// memory and only re-read when the file has changed.
let cache: { stamp: string; accounts: Account[]; byDevice: Map<string, Account> } | null = null;

function stamp(): string {
  try {
    const s = fs.statSync(ACCOUNTS_PATH);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return "none";
  }
}

function loadAccounts(): { accounts: Account[]; byDevice: Map<string, Account> } {
  const s = stamp();
  if (cache && cache.stamp === s) return cache;
  const accounts = readJson<{ accounts: Account[] }>(ACCOUNTS_PATH, { accounts: [] }).accounts ?? [];
  cache = { stamp: s, accounts, byDevice: new Map(accounts.map((a) => [a.canonicalDeviceId, a])) };
  return cache;
}

function saveAccounts(accounts: Account[]) {
  writeJsonAtomic(ACCOUNTS_PATH, { accounts });
  cache = null;
}

const loadCodes = () => readJson<{ codes: LoginCode[] }>(CODES_PATH, { codes: [] }).codes ?? [];
const saveCodes = (codes: LoginCode[]) => writeJsonAtomic(CODES_PATH, { codes });
const loadSessions = () => readJson<{ sessions: Session[] }>(SESSIONS_PATH, { sessions: [] }).sessions ?? [];
const saveSessions = (sessions: Session[]) => writeJsonAtomic(SESSIONS_PATH, { sessions });

/* ------------------------------- emails ------------------------------- */

/** A tidy, lower-case email address, or null if it does not look like one. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

/* -------------------------------- codes -------------------------------- */

const hashCode = (code: string, salt: string) => crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");

/**
 * Makes a new 6-digit code for an email and remembers only its hash. Refuses when it is asked for
 * again too quickly or too often. The reason is returned so the caller can say something kind
 * without telling anyone whether the email has an account.
 */
export function issueCode(email: string, now = Date.now()): { code: string } | { error: "wait" | "too-many" } {
  const codes = loadCodes().filter((c) => c.expiresAt > now - 60 * 60_000);
  const existing = codes.find((c) => c.email === email);
  const sends = (existing?.sends ?? []).filter((t) => t > now - 60 * 60_000);

  if (sends.length > 0 && now - sends[sends.length - 1] < RESEND_GAP_MS) return { error: "wait" };
  if (sends.length >= MAX_CODES_PER_HOUR) return { error: "too-many" };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = crypto.randomBytes(8).toString("hex");
  const record: LoginCode = { email, codeHash: hashCode(code, salt), salt, expiresAt: now + CODE_TTL_MS, attempts: 0, sends: [...sends, now] };
  saveCodes([...codes.filter((c) => c.email !== email), record]);
  return { code };
}

export type CodeResult = { ok: true } | { ok: false; reason: "wrong" | "expired" | "locked"; attemptsLeft?: number };

/** Checks a code. Right: it is used up. Wrong five times: it is burned and a new one is needed. */
export function checkCode(email: string, code: unknown, now = Date.now()): CodeResult {
  const codes = loadCodes();
  const record = codes.find((c) => c.email === email);
  if (!record) return { ok: false, reason: "expired" };
  if (record.expiresAt <= now) {
    saveCodes(codes.filter((c) => c !== record));
    return { ok: false, reason: "expired" };
  }
  const given = typeof code === "string" ? code.trim() : "";
  const right =
    /^\d{6}$/.test(given) &&
    crypto.timingSafeEqual(Buffer.from(hashCode(given, record.salt)), Buffer.from(record.codeHash));

  if (right) {
    saveCodes(codes.filter((c) => c !== record));
    return { ok: true };
  }
  record.attempts += 1;
  if (record.attempts >= MAX_WRONG_TRIES) {
    saveCodes(codes.filter((c) => c !== record));
    return { ok: false, reason: "locked" };
  }
  saveCodes(codes);
  return { ok: false, reason: "wrong", attemptsLeft: MAX_WRONG_TRIES - record.attempts };
}

/* ------------------------------- accounts ------------------------------- */

export function accountOwningDevice(deviceId: string): Account | null {
  return loadAccounts().byDevice.get(deviceId) ?? null;
}

/** The account for an email address, if there is one. */
export function accountByEmail(email: string): Account | null {
  const wanted = normaliseEmail(email);
  return wanted ? loadAccounts().accounts.find((a) => a.email === wanted) ?? null : null;
}

export function accountById(id: string): Account | null {
  return loadAccounts().accounts.find((a) => a.id === id) ?? null;
}

const usableDeviceId = (id: unknown): id is string =>
  typeof id === "string" && id.length >= 8 && id.length <= 200 && !id.startsWith("system:");

/**
 * The account for a verified email, made if it is new. A NEW account keeps the phone's current id
 * as its own (so listings and messages made before signing up stay theirs) as long as no other
 * account already owns it; otherwise it is given a fresh secret one. An EXISTING account keeps
 * the id it already has: that is what a phone adopts when signing in again.
 */
export function findOrCreateAccount(email: string, currentDeviceId: unknown, now = new Date()): { account: Account; isNew: boolean } {
  const { accounts, byDevice } = loadAccounts();
  const found = accounts.find((a) => a.email === email);
  if (found) {
    found.lastLoginAt = now.toISOString();
    saveAccounts(accounts);
    return { account: found, isNew: false };
  }
  const canonical =
    usableDeviceId(currentDeviceId) && !byDevice.has(currentDeviceId)
      ? currentDeviceId
      : crypto.randomBytes(24).toString("hex");
  const account: Account = {
    id: crypto.randomUUID(),
    email,
    canonicalDeviceId: canonical,
    createdAt: now.toISOString(),
    lastLoginAt: now.toISOString(),
  };
  saveAccounts([...accounts, account]);
  return { account, isNew: true };
}

/* ------------------------------- sessions ------------------------------- */

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** A session token for an account: shown once, kept only as a hash. Oldest sessions are dropped past ten. */
export function createSession(accountId: string, now = Date.now()): string {
  const token = `fp_${crypto.randomBytes(32).toString("base64url")}`;
  const mine = loadSessions().filter((s) => s.expiresAt > now);
  const ofThisAccount = mine.filter((s) => s.accountId === accountId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const drop = new Set(ofThisAccount.slice(0, Math.max(0, ofThisAccount.length - (MAX_SESSIONS - 1))).map((s) => s.tokenHash));
  saveSessions([
    ...mine.filter((s) => !drop.has(s.tokenHash)),
    {
      tokenHash: hashToken(token),
      accountId,
      createdAt: new Date(now).toISOString(),
      lastUsedAt: new Date(now).toISOString(),
      expiresAt: now + SESSION_DAYS * 24 * 60 * 60_000,
    },
  ]);
  return token;
}

/** The account a session token belongs to, or null. Using it keeps it alive (a sliding 90 days). */
export function accountForToken(token: string | null | undefined, now = Date.now()): Account | null {
  if (!token || !token.startsWith("fp_") || token.length > 200) return null;
  const hash = hashToken(token);
  const sessions = loadSessions();
  const session = sessions.find((s) => s.tokenHash === hash);
  if (!session || session.expiresAt <= now) return null;

  // Refresh at most once an hour, so reading a session doesn't rewrite the file on every request.
  if (now - Date.parse(session.lastUsedAt) > 60 * 60_000) {
    session.lastUsedAt = new Date(now).toISOString();
    session.expiresAt = now + SESSION_DAYS * 24 * 60 * 60_000;
    saveSessions(sessions);
  }
  return accountById(session.accountId);
}

export function revokeSession(token: string): void {
  const hash = hashToken(token);
  saveSessions(loadSessions().filter((s) => s.tokenHash !== hash));
}

/** Deletes an account, every session it has, and any code waiting for its email. */
export function deleteAccount(id: string): boolean {
  const { accounts } = loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return false;
  saveAccounts(accounts.filter((a) => a.id !== id));
  deleteAccountCredits(id);
  saveSessions(loadSessions().filter((s) => s.accountId !== id));
  saveCodes(loadCodes().filter((c) => c.email !== account.email));
  return true;
}

/** Clean-up for the retention job: expired codes and sessions, and accounts nobody has signed in to for a long time. */
export function purgeAuth(inactiveMonths: number, now = new Date()): { codes: number; sessions: number; accounts: number } {
  const t = now.getTime();
  const codes = loadCodes();
  const keptCodes = codes.filter((c) => c.expiresAt > t - 60 * 60_000);
  if (keptCodes.length !== codes.length) saveCodes(keptCodes);

  const sessions = loadSessions();
  const keptSessions = sessions.filter((s) => s.expiresAt > t);
  if (keptSessions.length !== sessions.length) saveSessions(keptSessions);

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - inactiveMonths);
  const { accounts } = loadAccounts();
  const activeIds = new Set(keptSessions.map((s) => s.accountId));
  const keptAccounts = accounts.filter((a) => activeIds.has(a.id) || Date.parse(a.lastLoginAt) >= cutoff.getTime());
  if (keptAccounts.length !== accounts.length) {
    saveAccounts(keptAccounts);
    // Credits held by an account that is deleted for being unused are forfeited with it.
    const kept = new Set(keptAccounts.map((a) => a.id));
    for (const a of accounts) if (!kept.has(a.id)) deleteAccountCredits(a.id);
  }

  return {
    codes: codes.length - keptCodes.length,
    sessions: sessions.length - keptSessions.length,
    accounts: accounts.length - keptAccounts.length,
  };
}
