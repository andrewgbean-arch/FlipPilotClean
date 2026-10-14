/**
 * How much signing up one NETWORK may do in a day.
 *
 * Signing in sends an email (which costs us a little each time and has a sending allowance), and every new
 * account is a fresh set of free scans. Per email address there are already limits (one code every 30
 * seconds, five an hour), but a script that makes up a new address each time gets round all of them.
 * What it cannot make up is the network it connects from, so each network has a daily allowance of:
 *   - sign-in codes sent (SIGNUP_CODES_PER_NETWORK_PER_DAY, default 60), and
 *   - brand-new accounts made (SIGNUP_ACCOUNTS_PER_NETWORK_PER_DAY, default 25).
 * Generous on purpose: a household, an office, a boot fair's wifi or a mobile network sharing one address
 * between many people should not notice it. See clientAddress.ts for what counts as one network.
 *
 * Memory only, like the rate limiter: nothing about the network is written anywhere, and a restart can
 * only give a few extra sign-ups.
 */

export type SignupKind = "codes" | "accounts";

const DEFAULTS: Record<SignupKind, number> = { codes: 60, accounts: 25 };
const ENV_NAMES: Record<SignupKind, string> = {
  codes: "SIGNUP_CODES_PER_NETWORK_PER_DAY",
  accounts: "SIGNUP_ACCOUNTS_PER_NETWORK_PER_DAY",
};

export function signupLimit(kind: SignupKind): number {
  const fromEnv = Number(process.env[ENV_NAMES[kind]]);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULTS[kind];
}

const used = new Map<string, { day: string; count: number }>();

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const keyOf = (kind: SignupKind, network: string) => `${kind}:${network}`;

function current(kind: SignupKind, network: string, now: number) {
  const today = dayOf(now);
  const existing = used.get(keyOf(kind, network));
  return existing && existing.day === today ? existing : { day: today, count: 0 };
}

/** How many more this network may do today. With no network to go by, nothing is limited. */
export function signupAllowanceLeft(kind: SignupKind, network: string | null | undefined, now = Date.now()): number {
  if (!network) return Number.POSITIVE_INFINITY;
  return Math.max(0, signupLimit(kind) - current(kind, network, now).count);
}

/** Uses one if any are left today. Returns whether one was used. */
export function takeSignupAllowance(kind: SignupKind, network: string | null | undefined, now = Date.now()): boolean {
  if (!network) return true;
  const record = current(kind, network, now);
  if (record.count >= signupLimit(kind)) return false;
  record.count += 1;
  if (used.size >= 20_000) {
    const today = dayOf(now);
    for (const [key, r] of used) if (r.day !== today) used.delete(key);
  }
  used.set(keyOf(kind, network), record);
  return true;
}

/** Gives one back, for something that turned out not to happen (the email could not be sent). */
export function returnSignupAllowance(kind: SignupKind, network: string | null | undefined, now = Date.now()): void {
  if (!network) return;
  const record = used.get(keyOf(kind, network));
  if (!record || record.day !== dayOf(now) || record.count < 1) return;
  record.count -= 1;
}

export function clearSignupLimitsForTests() {
  used.clear();
}
