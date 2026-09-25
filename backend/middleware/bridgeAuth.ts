import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * The link between FlipPilot Dealer OS and this Marketplace. Dealer OS holds
 * MARKETPLACE_BRIDGE_KEY and sends it in x-bridge-key; nothing else can reach a
 * /bridge route. With no key set on this server the routes do not exist (404),
 * and a key shorter than 32 characters is treated as not set.
 */
export function bridgeKey(): string | null {
  const key = (process.env.MARKETPLACE_BRIDGE_KEY ?? "").trim();
  return key.length >= 32 ? key : null;
}

export function bridgeAuth(req: Request, res: Response, next: NextFunction) {
  const key = bridgeKey();
  if (!key) return res.status(404).json({ ok: false, error: "Not found" });

  const header = req.headers["x-bridge-key"];
  const given = Buffer.from(String(Array.isArray(header) ? header[0] : header ?? ""));
  const wanted = Buffer.from(key);
  const same = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!same) return res.status(401).json({ ok: false, error: "Bad bridge key" });
  next();
}
