import type { Advert } from "./advertStore";
import { PLACEMENT_NAMES, pounds } from "./advertPricing";
import { sendEmail } from "./mailer";

/**
 * The emails the advertising portal sends. Each one says the same thing the portal shows on
 * screen, so nothing depends on an email arriving. FlipPilot itself is told about new adverts and
 * invoice requests at ADVERTS_NOTIFY_EMAIL (or EMAIL_REPLY_TO).
 */

export function portalUrl(): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/advertise` : "/advertise";
}

function staffAddress(): string | null {
  const v = (process.env.ADVERTS_NOTIFY_EMAIL ?? process.env.EMAIL_REPLY_TO ?? "").trim();
  return v || null;
}

const places = (ad: Advert) => ad.placements.map((p) => PLACEMENT_NAMES[p] ?? p).join(", ");

function priceLine(ad: Advert): string {
  const b = ad.booking;
  if (!b) return "";
  return b.launchMonthlyPence !== null && b.launchMonths > 0
    ? `${pounds(b.launchMonthlyPence)} a month for your first ${b.launchMonths} months, then ${pounds(b.monthlyPence)} a month`
    : `${pounds(b.monthlyPence)} a month`;
}

const sign = "\n\nThanks,\nFlipPilot";

async function send(to: string | null | undefined, subject: string, body: string) {
  if (!to) return;
  await sendEmail(to, subject, body + sign);
}

/** Who booked it: the account's email, found by the caller. */
export const advertEmails = {
  /** Sent when a business sends an advert (new or changed). */
  async submitted(ad: Advert, to: string, alreadyApproved: boolean) {
    await send(
      to,
      alreadyApproved ? `Your advert "${ad.title}" is approved: pay to go live` : `We've got your advert "${ad.title}"`,
      alreadyApproved
        ? `Your advert "${ad.title}" (${places(ad)}) passed our checks. Pay in your advertising portal to go live: ${portalUrl()}\n\nPrice: ${priceLine(ad)}.`
        : `Thanks for your advert "${ad.title}" (${places(ad)}). A person reads every advert before it shows, usually within one working day. We'll email you when it's approved, and you'll pay then: nothing is charged before.\n\nYour portal: ${portalUrl()}`
    );
    if (!alreadyApproved) {
      await send(staffAddress(), `New advert to review: ${ad.advertiser}, "${ad.title}"`, `${ad.advertiser} sent an advert (${places(ad)}, ${priceLine(ad)}). The AI said: ${ad.aiReview?.verdict ?? "not checked"}.\n\nReview it: ${portalUrl()}/admin`);
    }
  },

  async approved(ad: Advert, to: string) {
    await send(to, `Your advert "${ad.title}" is approved: pay to go live`, `Good news: your advert "${ad.title}" is approved. Pay in your advertising portal and it shows from ${new Date(ad.startsAt).toLocaleDateString("en-GB")} (or straight away, if that date has passed): ${portalUrl()}\n\nPrice: ${priceLine(ad)}. We hold your place for 7 days.`);
  },

  async rejected(ad: Advert, to: string, reason: string) {
    await send(to, `Your advert "${ad.title}" needs a change`, `We couldn't approve your advert "${ad.title}" as it is.\n\nWhy: ${reason}\n\nChange it in your advertising portal and send it again: ${portalUrl()}\n\nNothing has been charged.`);
  },

  async live(ad: Advert, to: string) {
    await send(to, `Your advert "${ad.title}" is booked`, `Payment received: thank you. Your advert "${ad.title}" shows in the FlipPilot app (${places(ad)}) from ${new Date(ad.startsAt).toLocaleDateString("en-GB")}. It renews monthly until you cancel, and you can see how it's doing, by day, in your portal: ${portalUrl()}`);
  },

  async invoiceRequested(ad: Advert, to: string) {
    await send(to, `Invoice requested for "${ad.title}"`, `Thanks: we'll email you an invoice for your advert "${ad.title}" (${priceLine(ad)}). It goes live once it's paid.`);
    await send(staffAddress(), `Invoice requested: ${ad.advertiser}, "${ad.title}"`, `${ad.advertiser} (${to}) asked to pay by invoice for "${ad.title}": ${places(ad)}, ${priceLine(ad)}. When it's paid, mark it paid on the admin page: ${portalUrl()}/admin`);
  },

  async paymentFailed(ad: Advert, to: string) {
    await send(to, `Payment for "${ad.title}" didn't go through`, `We couldn't take this month's payment for your advert "${ad.title}". Please update your card from the link in Stripe's email, or in your portal: ${portalUrl()}\n\nYour advert stops at the end of the month already paid for if the payment isn't made.`);
  },

  async ended(ad: Advert, to: string) {
    await send(to, `Your advert "${ad.title}" has ended`, `Your advert "${ad.title}" has finished. Its results stay in your portal, and you can book again any time: ${portalUrl()}`);
  },
};
