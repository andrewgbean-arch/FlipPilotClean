import type { Advert } from "./advertStore";

/**
 * The steps of a portal booking that both the business's routes and the admin routes take.
 */

/** How long an unpaid booking keeps its place in a full area: a week to be reviewed and paid for. */
export const HOLD_DAYS = 7;
const DAY = 24 * 3600 * 1000;

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 January + 1 month is the last day of February, not 3 March.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString();
}

/**
 * Approved: a new booking now waits to be paid for (its place held another week); one already
 * paid for (it was edited and read again) simply goes back on.
 */
export function approveForPayment(ad: Advert, by: "person" | "auto", now = new Date()) {
  ad.approved = true;
  ad.approvedBy = by;
  ad.approvedAt = now.toISOString();
  if (ad.booking && ad.booking.status === "in-review") {
    ad.booking.status = "awaiting-payment";
    ad.booking.reviewedAt = now.toISOString();
    ad.booking.rejectedReason = null;
    ad.booking.holdUntil = new Date(now.getTime() + HOLD_DAYS * DAY).toISOString();
  } else if (ad.booking) {
    ad.booking.reviewedAt = now.toISOString();
    ad.booking.rejectedReason = null;
  }
}

/** Turned down, with the reason the business is shown. Its place is let go. */
export function rejectBooking(ad: Advert, reason: string, now = new Date()) {
  ad.approved = false;
  ad.approvedBy = null;
  if (!ad.booking) return;
  const paid = ad.booking.status === "active" || ad.booking.status === "cancelling";
  // A paid advert that was edited into something we can't show stays paid for; it just doesn't
  // show until they change it again. An unpaid one is rejected outright.
  if (!paid) {
    ad.booking.status = "rejected";
    ad.booking.holdUntil = null;
  }
  ad.booking.rejectedReason = reason;
  ad.booking.reviewedAt = now.toISOString();
}

/** Paid by invoice (or any other way outside Stripe): live for this many months from its start or today. */
export function markPaid(ad: Advert, months: number, now = new Date()) {
  if (!ad.booking) return;
  const from = ad.booking.paidThrough && new Date(ad.booking.paidThrough).getTime() > now.getTime()
    ? ad.booking.paidThrough
    : new Date(Math.max(new Date(ad.startsAt).getTime(), now.getTime())).toISOString();
  if (!ad.booking.paidThrough || new Date(ad.booking.paidThrough).getTime() <= now.getTime()) {
    if (new Date(ad.startsAt).getTime() < now.getTime()) ad.startsAt = now.toISOString();
  }
  ad.booking.status = "active";
  ad.booking.paidAt = now.toISOString();
  ad.booking.paidThrough = addMonths(from, months);
  ad.booking.holdUntil = null;
  ad.booking.invoiceRequested = false;
  ad.endsAt = ad.booking.paidThrough;
}
