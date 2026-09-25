import crypto from "crypto";

/**
 * Proof that a price lookup follows a real scan.
 *
 * A scan is two steps: "what is it?" (charged: a free scan or a credit) and "what is it worth?" (where the
 * expensive Google search happens). Without proof, anyone who has seen the app's traffic could call the second
 * step on its own and use it as a free price service. So the first step hands back a short-lived signed token,
 * and the second refuses a request that has none.
 *
 *  - It is tied to the phone that made the scan, so it can't be passed on.
 *  - It runs out after 30 minutes.
 *  - It works for 8 price lookups: enough for changing Condition and Age or correcting the name on the result
 *    screen, not enough to be a price service.
 *
 * Signed with SCAN_TOKEN_SECRET (or TOKEN_ENCRYPTION_KEY). With neither set, a random secret is made when the
 * server starts, which works but means a scan in progress during a restart has to be repeated, and would not
 * work across several server instances: set SCAN_TOKEN_SECRET on a real host.
 */

const TTL_MS = 30 * 60_000;
export const SCAN_TOKEN_MAX_USES = 8;

const bootSecret = crypto.randomBytes(32).toString("hex");
export const scanTokenSecretIsSet = () => Boolean((process.env.SCAN_TOKEN_SECRET ?? process.env.TOKEN_ENCRYPTION_KEY ?? "").trim());
const secret = () => (process.env.SCAN_TOKEN_SECRET ?? "").trim() || (process.env.TOKEN_ENCRYPTION_KEY ?? "").trim() || bootSecret;

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

// How many times each token has been used. Memory only: a restart forgets it, which can only give a token a few more uses.
const uses = new Map<string, { count: number; exp: number }>();

function prune(now: number) {
  if (uses.size < 5000) return;
  for (const [id, u] of uses) if (u.exp < now) uses.delete(id);
}

export function issueScanToken(deviceId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ d: deviceId, id: crypto.randomBytes(9).toString("hex"), exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type ScanTokenResult =
  | { ok: true; usesLeft: number }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "wrong-phone" | "used-up" };

/** Checks a token and, if it is good, counts one use of it. */
export function useScanToken(token: unknown, deviceId: string, now = Date.now()): ScanTokenResult {
  if (typeof token !== "string" || !token) return { ok: false, reason: "missing" };
  const dot = token.indexOf(".");
  if (dot < 1 || token.length > 600) return { ok: false, reason: "invalid" };

  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const wanted = Buffer.from(sign(payload));
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return { ok: false, reason: "invalid" };

  let claims: { d?: unknown; id?: unknown; exp?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof claims.id !== "string" || typeof claims.exp !== "number") return { ok: false, reason: "invalid" };
  if (claims.exp <= now) return { ok: false, reason: "expired" };
  if (claims.d !== deviceId) return { ok: false, reason: "wrong-phone" };

  prune(now);
  const entry = uses.get(claims.id) ?? { count: 0, exp: claims.exp };
  if (entry.count >= SCAN_TOKEN_MAX_USES) return { ok: false, reason: "used-up" };
  entry.count += 1;
  uses.set(claims.id, entry);
  return { ok: true, usesLeft: SCAN_TOKEN_MAX_USES - entry.count };
}
