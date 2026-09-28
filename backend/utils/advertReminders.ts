import { Advert, loadAdverts, saveAdverts } from "./advertStore";
import { accountById } from "./accountStore";
import { advertEmails } from "./advertEmails";

/**
 * Reminders before a booked advert stops (run every six hours from server.ts).
 *
 * A card payer's advert renews by itself, so they hear nothing. The two that would otherwise just
 * stop without anyone noticing are:
 *   - "renew": paid by invoice and still running. The business is told when it ends and can ask
 *     for next month's invoice in one tap; FlipPilot is told to send it.
 *   - "ending": cancelled, so it stops at the end of the month paid for. The business is told, in
 *     case they want to book again.
 *
 * Each is sent once per paid period: the reminder remembers which paid-up date it was sent for,
 * and it is saved BEFORE any email goes, so a crash or a second server can't send it twice.
 */

export const REMIND_DAYS_BEFORE = 7;
const DAY = 86400e3;

export type Reminder = { ad: Advert; kind: "renew" | "ending" };

/** Which adverts are due a reminder now. */
export function dueReminders(all: Advert[], now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  for (const ad of all) {
    const b = ad.booking;
    if (!b?.paidThrough || !ad.ownerAccountId) continue;
    const ends = new Date(b.paidThrough).getTime();
    const left = ends - now.getTime();
    if (!(left > 0 && left <= REMIND_DAYS_BEFORE * DAY)) continue;
    if (b.reminderSentFor === b.paidThrough) continue;
    const byCard = !!b.stripe?.subscriptionId;
    if (b.status === "active" && !byCard && ad.approved) out.push({ ad, kind: "renew" });
    else if (b.status === "cancelling") out.push({ ad, kind: "ending" });
  }
  return out;
}

/** Sends what is due. Returns how many reminders went out. */
export async function runAdvertReminders(now = new Date()): Promise<number> {
  const all = loadAdverts();
  const due = dueReminders(all, now);
  if (due.length === 0) return 0;
  for (const { ad } of due) ad.booking!.reminderSentFor = ad.booking!.paidThrough;
  saveAdverts(all);

  for (const { ad, kind } of due) {
    const to = accountById(ad.ownerAccountId!)?.email;
    if (!to) continue;
    try {
      if (kind === "renew") await advertEmails.renewalDue(ad, to);
      else await advertEmails.endingSoon(ad, to);
    } catch (err: any) {
      console.log("Advert reminder email failed:", err?.message ?? err);
    }
  }
  return due.length;
}
