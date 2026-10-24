/**
 * The eBay listings shown as small cards under a scan result's prices ("On eBay right now"), and the rules for
 * when eBay's block may be shown at all.
 *
 * eBay's API licence lets an app show eBay listings, on conditions that shape everything in this file:
 *   - eBay's content stays visually apart from everything else, so it gets a block of its own and is never mixed
 *     into our prices or Google's;
 *   - listing details are never more than six hours behind eBay's site, and go when the listing goes, so the cards
 *     live only on the screen, carry the time they were checked, are hidden after five hours, and are never saved;
 *   - nothing is copied or kept beyond that, so none of this touches `market`, which is what History stores.
 */
import { rangeHoldsPrice } from "./priceRange";

export type EbayCard = {
  title: string;
  /** The listing's own asking price, in pounds. */
  price: number;
  image: string | null;
  /** The listing's page on eBay. */
  link: string;
  condition: string | null;
};

/** How many listings are shown as cards. */
export const MAX_EBAY_CARDS = 5;

/** eBay allows listing details up to six hours old; the block goes an hour sooner than that. */
export const EBAY_FRESH_MS = 5 * 60 * 60 * 1000;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// A card opens its link when tapped, so the link must be one of eBay's own pages and nothing else.
const EBAY_PAGE = /^https:\/\/([a-z0-9-]+\.)*ebay\.(co\.uk|com)(\/|\?|$)/i;

export const safeEbayLink = (url: unknown): string | null =>
  typeof url === "string" && EBAY_PAGE.test(url.trim()) ? url.trim() : null;

export const safeImageUrl = (url: unknown): string | null =>
  typeof url === "string" && /^https:\/\//i.test(url.trim()) ? url.trim() : null;

// The server sends a listing's price as text ("£12.34").
const poundsFrom = (v: unknown): number | null => {
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const middleOf = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Up to `max` of the listings behind eBay's range, to show as cards: the ones nearest the typical price, so a
 * stray cheap extra or a pricey outlier never headlines, in price order. `market` is the raw market object of a
 * /price reply, whose eBay listings the rest of the app drops (see pickMarket in scanTransform.ts).
 *
 * A listing only counts when its own price is the one eBay's range was worked from: the server scales a listing
 * that states a different pack size to the pack that was scanned, and a card must show what the listing really
 * costs, so those are left out. Listings the range itself threw out as outliers are left out too, so no card is
 * cheaper or dearer than the From and To above it.
 */
export function pickEbayCards(market: any, max: number = MAX_EBAY_CARDS): EbayCard[] {
  const low = num(market?.ebay?.lowest);
  const high = num(market?.ebay?.highest);
  const items: unknown = market?.ebayItems ?? market?.ebay?.items;
  if (low == null || high == null || !Array.isArray(items)) return [];

  const seen = new Set<string>();
  const candidates: EbayCard[] = [];
  for (const item of items) {
    const link = safeEbayLink(item?.link);
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, 140) : "";
    const price = poundsFrom(item?.price);
    const counted = num(item?.extracted_price);
    if (!link || !title || price == null || counted == null) continue;
    if (Math.abs(price - counted) > 0.005) continue;
    if (price < low - 0.005 || price > high + 0.005) continue;

    // The same listing can come back twice, and its link carries tracking after the "?".
    const key = link.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);

    const condition = typeof item?.condition === "string" ? item.condition.trim().slice(0, 24) : "";
    candidates.push({ title, price, image: safeImageUrl(item?.thumbnail), link, condition: condition || null });
  }
  if (candidates.length === 0) return [];

  const withPicture = candidates.filter((c) => c.image != null);
  const pool = withPicture.length >= max ? withPicture : candidates;
  const typical = middleOf(pool.map((c) => c.price).sort((a, b) => a - b));
  return [...pool]
    .sort((a, b) => Math.abs(a.price - typical) - Math.abs(b.price - typical) || a.price - b.price)
    .slice(0, max)
    .sort((a, b) => a.price - b.price);
}

/**
 * eBay's From and To, or null when the block should not be drawn: no usable range, or a range that does not hold
 * the Fair market price (the same test the track under that price uses, see priceRange.ts). When eBay's search
 * caught parts and extras around a £510 e-bike its range read £40 to £165; the track was already refused for
 * that, and the block must not print the same figures in words.
 */
export function ebayRangeToShow(ebay: any, fair: unknown): { low: number; high: number } | null {
  const low = num(ebay?.lowest);
  const high = num(ebay?.highest);
  if (low == null || high == null || low <= 0 || high < low) return null;
  return rangeHoldsPrice(low, high, num(fair)) ? { low, high } : null;
}

/** Whether eBay's content, checked at `checkedAt` (milliseconds), is still recent enough to show at `now`. */
export function isEbayCheckFresh(checkedAt: unknown, now: number, maxAgeMs: number = EBAY_FRESH_MS): boolean {
  const at = num(checkedAt);
  if (at == null) return false;
  const age = now - at;
  // A clock set back a few minutes is forgiven; a time far in the future is not a time anyone checked.
  return age <= maxAgeMs && age >= -5 * 60 * 1000;
}

/** "14:05", the time the listings were checked, as the phone's clock reads it. */
export function clockTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
