import fs from "fs";
import { dataPath } from "../config/dataDir";

/**
 * Trade sellers: dealers who list their cars in the app itself, without the Dealer OS web app (22 Oct 2026).
 *
 * They say so (a business name, shown to buyers as "Trade seller", so a buyer always knows they are dealing with a
 * business) and may have several cars for sale at once, where a private seller may have one (see tradeCarLimit in
 * config/marketplacePolicy.ts). The record is a field on the seller (routes/sellers.ts, sellers.json), so it is exported,
 * erased and tidied away with the rest of a person's seller profile. This module only READS it, straight from that
 * file: the listing rules ask it, and routes/sellers.ts uses those rules, so it must not import routes/sellers back.
 */

export type TradeSeller = { businessName: string; since: string };

/** Is this phone a trade seller? Null when it is not (or when nothing is known: a private seller is the safe default). */
export function tradeSellerFor(deviceId: string | null | undefined): TradeSeller | null {
  if (typeof deviceId !== "string" || !deviceId) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath("sellers.json"), "utf8"));
    const seller = (Array.isArray(parsed?.sellers) ? parsed.sellers : []).find((s: any) => s?.deviceId === deviceId);
    const t = seller?.tradeSeller;
    return t && typeof t.businessName === "string" && t.businessName ? { businessName: t.businessName, since: String(t.since ?? "") } : null;
  } catch {
    return null;
  }
}

/**
 * A business name worth showing on every advert: one line, 2 to 60 characters, and no contact details smuggled into it
 * (a web address, an email or a phone number belongs in a conversation, not on a badge).
 */
export function cleanBusinessName(raw: unknown): { ok: true; name: string } | { ok: false; message: string } {
  if (typeof raw !== "string") return { ok: false, message: "Enter your business name." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Enter your business name (at least 2 characters)." };
  if (name.length > 60) return { ok: false, message: "That's too long: keep your business name to 60 characters." };
  if (!/[A-Za-z0-9]/.test(name)) return { ok: false, message: "Your business name needs some letters or numbers." };
  if (/@|https?:|www\.|\.(com|co\.uk|uk|net|org)\b/i.test(name) || /\d[\d\s-]{7,}\d/.test(name)) {
    return { ok: false, message: "Use just your trading name: no web address, email address or phone number." };
  }
  return { ok: true, name };
}
