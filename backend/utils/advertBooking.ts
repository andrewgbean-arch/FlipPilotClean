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
  if (!ad.booking.firstPaidAt) ad.booking.firstPaidAt = from;
  ad.booking.paidAt = now.toISOString();
  ad.booking.paidThrough = addMonths(from, months);
  ad.booking.holdUntil = null;
  ad.booking.invoiceRequested = false;
  ad.endsAt = ad.booking.paidThrough;
}

/**
 * The launch offer's promise: if a business's first paid month is quieter than it hoped, it can
 * ask for a month free. Any booking made under the launch offer can ask once, from the end of its
 * first paid month until FREE_MONTH_ASK_MONTHS months after that, while the advert is still
 * running. A person at FlipPilot then adds it (see grantFreeMonth).
 */
export const FREE_MONTH_ASK_MONTHS = 2;

export type FreeMonthState =
  | "none" // not a launch-offer booking, or never paid for
  | "not-yet" // its first paid month isn't over
  | "can-ask"
  | "not-running" // cancelled or ended: there's no next month to make free
  | "too-late"
  | "asked"
  | "granted"
  | "declined";

export function freeMonthState(ad: Advert, now = new Date()): { state: FreeMonthState; askFrom: string | null; askUntil: string | null } {
  const b = ad.booking;
  const first = b?.firstPaidAt ?? null;
  const askFrom = first ? addMonths(first, 1) : null;
  const askUntil = first ? addMonths(first, 1 + FREE_MONTH_ASK_MONTHS) : null;
  const out = (state: FreeMonthState) => ({ state, askFrom, askUntil });
  if (!b || !(b.launchMonths > 0) || !first) return out("none");
  if (b.freeMonth?.granted === true) return out("granted");
  if (b.freeMonth?.granted === false) return out("declined");
  if (b.freeMonth?.requestedAt) return out("asked");
  if (now.getTime() < new Date(askFrom!).getTime()) return out("not-yet");
  if (now.getTime() > new Date(askUntil!).getTime()) return out("too-late");
  if (b.status !== "active") return out("not-running");
  return out("can-ask");
}

/**
 * Adds the free month to an advert paid by invoice: a month more of paid time. (One paid by card
 * gets a credit on its Stripe account instead, which pays its next monthly invoice: see
 * advertBilling.creditNextMonth. Its paid time then moves on as usual when that invoice is paid.)
 */
export function extendPaidTime(ad: Advert, months: number, now = new Date()) {
  if (!ad.booking) return;
  const from = ad.booking.paidThrough && new Date(ad.booking.paidThrough).getTime() > now.getTime() ? ad.booking.paidThrough : now.toISOString();
  ad.booking.paidThrough = addMonths(from, months);
  ad.endsAt = ad.booking.paidThrough;
}
