import type { BusinessAdvert } from "@/lib/businessAdverts";

/** A row in the feed: a listing, or a paid advert placed between listings. */
export type FeedRow = { kind: "listing"; item: any } | { kind: "ad"; advert: BusinessAdvert; slot: number };

/**
 * Puts adverts between the listings: one after the 3rd, then one every 6 after
 * that. If there are adverts but too few listings to reach the first slot, one
 * goes at the end, so what an advertiser paid for is never silently skipped.
 * A sole sponsor is the only advert, repeated; otherwise the shared ones take
 * turns. With no adverts booked the feed is exactly the listings.
 */
export function withAdverts(listings: any[], adverts: BusinessAdvert[]): FeedRow[] {
  const rows: FeedRow[] = [];
  let slot = 0;
  const nextAd = (): FeedRow => ({ kind: "ad", advert: adverts[slot % adverts.length], slot: slot++ });

  listings.forEach((item, i) => {
    rows.push({ kind: "listing", item });
    if (adverts.length > 0 && (i + 1) % 6 === 3) rows.push(nextAd());
  });
  if (adverts.length > 0 && listings.length > 0 && slot === 0) rows.push(nextAd());
  return rows;
}
