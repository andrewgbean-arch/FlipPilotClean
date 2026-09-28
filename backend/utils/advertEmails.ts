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
    ? `your first ${b.launchMonths} months for the price of 1 (${pounds(b.launchMonthlyPence)} a month), then ${pounds(b.monthlyPence)} a month`
    : `${pounds(b.monthlyPence)} a month`;
}

const sign = "\n\nThanks,\nFlipPilot";

const ukDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "the end of the month";

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

  /** Paid by invoice and ending within a week: offer the next invoice, and tell FlipPilot to send it. */
  async renewalDue(ad: Advert, to: string) {
    const ends = ukDate(ad.booking?.paidThrough);
    await send(
      to,
      `Your advert "${ad.title}" is paid up to ${ends}`,
      `Your advert "${ad.title}" is paid up to ${ends}. To keep it showing after that, ask for next month's invoice in your portal (one tap on the advert's page): ${portalUrl()}\n\nIf you'd rather let it end, you needn't do anything.`
    );
    await send(
      staffAddress(),
      `Invoice due soon: ${ad.advertiser}, "${ad.title}"`,
      `${ad.advertiser} (${to}) pays by invoice, and "${ad.title}" is paid up to ${ends} (${priceLine(ad)}). Send the next invoice if they want to carry on, then mark it paid on the admin page: ${portalUrl()}/admin`
    );
  },

  /** Cancelled and ending within a week: a friendly note, in case they want to book again. */
  async endingSoon(ad: Advert, to: string) {
    await send(
      to,
      `Your advert "${ad.title}" stops on ${ukDate(ad.booking?.paidThrough)}`,
      `As you cancelled, your advert "${ad.title}" stops showing on ${ukDate(ad.booking?.paidThrough)}, and nothing more will be charged. Changed your mind? You can book again any time in your portal: ${portalUrl()}`
    );
  },

  /** A business paying by invoice asks for next month's invoice from its portal. */
  async renewalInvoiceRequested(ad: Advert, to: string) {
    await send(to, `Next invoice requested for "${ad.title}"`, `Thanks: we'll email you next month's invoice for "${ad.title}" (${priceLine(ad)}). It keeps showing until ${ukDate(ad.booking?.paidThrough)}, and for another month once that's paid.`);
    await send(staffAddress(), `Next invoice requested: ${ad.advertiser}, "${ad.title}"`, `${ad.advertiser} (${to}) wants to carry on with "${ad.title}" (${priceLine(ad)}); it is paid up to ${ukDate(ad.booking?.paidThrough)}. Send the invoice, then mark it paid on the admin page: ${portalUrl()}/admin`);
  },

  async invoiceRequested(ad: Advert, to: string) {
    await send(to, `Invoice requested for "${ad.title}"`, `Thanks: we'll email you an invoice for your advert "${ad.title}" (${priceLine(ad)}). It goes live once it's paid.`);
    await send(staffAddress(), `Invoice requested: ${ad.advertiser}, "${ad.title}"`, `${ad.advertiser} (${to}) asked to pay by invoice for "${ad.title}": ${places(ad)}, ${priceLine(ad)}. When it's paid, mark it paid on the admin page: ${portalUrl()}/admin`);
  },

  async paymentFailed(ad: Advert, to: string) {
    await send(to, `Payment for "${ad.title}" didn't go through`, `We couldn't take this month's payment for your advert "${ad.title}". Please update your card from the link in Stripe's email, or in your portal: ${portalUrl()}\n\nYour advert stops at the end of the month already paid for if the payment isn't made.`);
  },

  async freeMonthAsked(ad: Advert, to: string, note: string | null) {
    await send(to, `Your free month for "${ad.title}"`, `Thanks for telling us. We'll add your free month to "${ad.title}" and email you when it's done, usually within one working day.`);
    await send(staffAddress(), `Free month asked for: ${ad.advertiser}, "${ad.title}"`, `${ad.advertiser} (${to}) asked for the launch offer's free month for "${ad.title}".${note ? `

They said: ${note}` : ""}

Add it on the admin page: ${portalUrl()}/admin`);
  },

  async freeMonthDecided(ad: Advert, to: string, granted: boolean, byCard: boolean, reason: string | null) {
    await send(
      to,
      granted ? `A free month for "${ad.title}"` : `About your free month for "${ad.title}"`,
      granted
        ? byCard
          ? `We've added a free month to "${ad.title}". Your next monthly payment is covered by a credit on your account, so nothing is taken from your card that month. Your advert keeps showing as normal.`
          : `We've added a free month to "${ad.title}": it now shows until ${new Date(ad.booking?.paidThrough ?? ad.endsAt).toLocaleDateString("en-GB")}, at no charge.`
        : `We weren't able to add a free month to "${ad.title}".${reason ? `

Why: ${reason}` : ""}

If you'd like to talk about it, just reply to this email.`
    );
  },

  async ended(ad: Advert, to: string) {
    await send(to, `Your advert "${ad.title}" has ended`, `Your advert "${ad.title}" has finished. Its results stay in your portal, and you can book again any time: ${portalUrl()}`);
  },
};
