import { RETENTION } from "../config/retention";

export type ListingStatus = "available" | "reserved" | "sold";

/**
 * Where a listing is in its life. Worked out from the timestamps each time it
 * is asked for, so a reservation that was never followed up ends on its own
 * after RETENTION.reservationDays and nothing depends on a job having run.
 */
export function listingStatus(listing: any, now = new Date()): ListingStatus {
  if (listing?.soldAt) return "sold";

  const reserved = typeof listing?.reservedAt === "string" ? Date.parse(listing.reservedAt) : NaN;
  if (Number.isFinite(reserved)) {
    const expires = reserved + RETENTION.reservationDays * 24 * 60 * 60 * 1000;
    if (now.getTime() < expires) return "reserved";
  }
  return "available";
}
