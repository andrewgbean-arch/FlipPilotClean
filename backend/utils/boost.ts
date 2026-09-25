import { listingStatus } from "./listingStatus";

/**
 * A listing is boosted while its paid week has not run out AND the listing is still live: a boost
 * doesn't outlive a sale or the listing's own 30 days.
 */
export function boostedUntilMs(listing: any): number {
  const at = Date.parse(String(listing?.boostedUntil ?? ""));
  return Number.isFinite(at) ? at : NaN;
}

export function isBoosted(listing: any, now = Date.now()): boolean {
  const until = boostedUntilMs(listing);
  if (!Number.isFinite(until) || until <= now) return false;
  const status = listingStatus(listing, new Date(now));
  return status === "available" || status === "reserved";
}

/** When the boost was bought, newest first is the fair order among boosted listings. */
export const boostedAtMs = (listing: any): number => {
  const at = Date.parse(String(listing?.boostedAt ?? ""));
  return Number.isFinite(at) ? at : 0;
};
