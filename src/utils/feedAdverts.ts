import type { BusinessAdvert } from "@/lib/businessAdverts";

/** A row in the feed: a listing, or a paid advert placed between listings. */
export type FeedRow = { kind: "listing"; item: any } | { kind: "ad"; advert: BusinessAdvert; slot: number };

/**
 * How often an advert appears: one for every this many listings. A listing card
 * is about a third of a screen tall, so six is roughly two full screens of
 * scrolling between adverts. Kept low on purpose: adverts should be noticed, not
 * be a nuisance. No advertiser can buy more than this, or take the whole feed.
 */
export const LISTINGS_PER_ADVERT = 6;

/**
 * Puts adverts between the listings: one after every sixth listing, so the
 * first appears after about two screens. The booked advertisers take turns. If
 * there are adverts but too few listings to reach the first slot, one goes at
 * the end, so what an advertiser paid for is never silently skipped. With no
 * adverts booked the feed is exactly the listings.
 */
export function withAdverts(listings: any[], adverts: BusinessAdvert[]): FeedRow[] {
  const rows: FeedRow[] = [];
  let slot = 0;
  const nextAd = (): FeedRow => ({ kind: "ad", advert: adverts[slot % adverts.length], slot: slot++ });

  listings.forEach((item, i) => {
    rows.push({ kind: "listing", item });
    if (adverts.length > 0 && (i + 1) % LISTINGS_PER_ADVERT === 0) rows.push(nextAd());
  });
  if (adverts.length > 0 && listings.length > 0 && slot === 0) rows.push(nextAd());
  return rows;
}
