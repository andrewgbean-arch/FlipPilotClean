import crypto from "crypto";
import type { Request, Response } from "express";

/**
 * The check every admin route uses. Off (404) unless ADMIN_TOKEN is set on the
 * server; otherwise the x-admin-token header must match it, compared in
 * constant time. Ten wrong guesses from one address in a minute lock that
 * address out for the rest of the minute, so the token can't be guessed by
 * hammering.
 */

const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 10;
const WINDOW_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [ip, f] of failures) if (now > f.resetAt) failures.delete(ip);
}, WINDOW_MS).unref();

export function adminOk(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(404).json({ ok: false, error: "Not enabled" });
    return false;
  }

  const ip = req.ip || "unknown";
  const now = Date.now();
  const past = failures.get(ip);
  if (past && now < past.resetAt && past.count >= MAX_FAILURES) {
    res.status(429).json({ ok: false, error: "Too many attempts. Try again in a minute." });
    return false;
  }

  const given = Buffer.from(String(req.headers["x-admin-token"] ?? ""));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    const f = past && now < past.resetAt ? past : { count: 0, resetAt: now + WINDOW_MS };
    f.count += 1;
    failures.set(ip, f);
    res.status(401).json({ ok: false, error: "Unauthorised" });
    return false;
  }

  failures.delete(ip);
  return true;
}
