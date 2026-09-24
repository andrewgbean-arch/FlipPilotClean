import { RETENTION } from "../config/retention";

export type ListingStatus = "available" | "reserved" | "sold" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a listing's current run started: when it was posted, or last relisted. */
export function listedAtMs(listing: any): number {
  const at = Date.parse(String(listing?.listedAt ?? listing?.createdAt ?? ""));
  return Number.isFinite(at) ? at : NaN;
}

/**
 * Where a listing is in its life. Worked out from the timestamps each time it
 * is asked for, so a listing that runs out (RETENTION.listingDays after it was
 * posted or relisted) or a reservation nobody followed up (reservationDays)
 * ends on its own and nothing depends on a job having run.
 */
export function listingStatus(listing: any, now = new Date()): ListingStatus {
  if (listing?.soldAt) return "sold";

  const listed = listedAtMs(listing);
  if (Number.isFinite(listed) && now.getTime() > listed + RETENTION.listingDays * DAY_MS) {
    return "expired";
  }

  const reserved = typeof listing?.reservedAt === "string" ? Date.parse(listing.reservedAt) : NaN;
  if (Number.isFinite(reserved)) {
    const expires = reserved + RETENTION.reservationDays * DAY_MS;
    if (now.getTime() < expires) return "reserved";
  }
  return "available";
}
