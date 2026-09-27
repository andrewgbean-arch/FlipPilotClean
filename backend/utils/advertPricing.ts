import type { Placement } from "./advertStore";

/**
 * What adverts cost: the price sheet (docs/advertise/index.html), held here so
 * the price a business sees, the price Stripe charges and the price on the page
 * can never disagree. Whole pence throughout.
 *
 *   Messages banner         £15 a month
 *   Marketplace feed        £25 a month
 *   Scan cross-over         £29 a month   (two advertisers share the scan screen)
 *   Scan full page          £99 a month   (the whole screen on your turn, up to 3 per area)
 *   All three shared ones   £59 a month   (messages + feed + cross-over together)
 *
 * Launch offer: half price for the first 2 months (ADVERT_LAUNCH_HALF_PRICE=off stops it for new
 * bookings). Local adverts reach people within 10, 25 or 50 miles of the business; nationwide is
 * quoted by a person, so it is never sold here. No VAT is added: FlipPilot isn't VAT registered.
 * Boot fairs adverts are booked by hand, not sold here.
 */

export const SELLABLE: readonly Placement[] = ["messages", "feed", "scan-panel", "scan-full"];

export const MONTHLY_PENCE: Record<string, number> = {
  messages: 1500,
  feed: 2500,
  "scan-panel": 2900,
  "scan-full": 9900,
};

export const PLACEMENT_NAMES: Record<string, string> = {
  messages: "Messages banner",
  feed: "Marketplace feed",
  "scan-panel": "Scan cross-over",
  "scan-full": "Scan full page",
  bootfairs: "Boot fairs",
};

export const SHARED_BUNDLE: readonly Placement[] = ["messages", "feed", "scan-panel"];
export const SHARED_BUNDLE_PENCE = 5900;

export const LAUNCH_MONTHS = 2;

export function launchOfferOn(): boolean {
  return (process.env.ADVERT_LAUNCH_HALF_PRICE ?? "").trim().toLowerCase() !== "off";
}

export type QuoteLine = { placement: Placement; name: string; monthlyPence: number };

export type Quote =
  | {
      ok: true;
      lines: QuoteLine[];
      /** The three shared placements booked together, and what that saves. */
      bundle: { savedPence: number } | null;
      /** The normal monthly price. */
      monthlyPence: number;
      /** What the first LAUNCH_MONTHS months cost each, when the launch offer applies. */
      launchMonthlyPence: number | null;
      launchMonths: number;
    }
  | { ok: false; error: string };

/**
 * The price of a booking. The full page and the cross-over can't be booked together: on a scan
 * the full page replaces the cross-over, so paying for both would buy nothing extra.
 */
export function quote(placements: readonly unknown[], scope: "local" | "nationwide", launchOffer = launchOfferOn()): Quote {
  const chosen = [...new Set(placements)];
  if (chosen.length === 0) return { ok: false, error: "Choose at least one place for your advert." };
  const bad = chosen.filter((p) => !SELLABLE.includes(p as Placement));
  if (bad.length > 0) return { ok: false, error: "That isn't one of the places you can book here." };
  const list = SELLABLE.filter((p) => chosen.includes(p));
  if (list.includes("scan-full") && list.includes("scan-panel")) {
    return { ok: false, error: "Choose the scan full page or the scan cross-over, not both: the full page takes the whole scan screen." };
  }
  if (scope === "nationwide") {
    return { ok: false, error: "Nationwide adverts are priced by a person. Send us a request and we'll come back with a price." };
  }

  const lines: QuoteLine[] = list.map((p) => ({ placement: p, name: PLACEMENT_NAMES[p], monthlyPence: MONTHLY_PENCE[p] }));
  const hasBundle = SHARED_BUNDLE.every((p) => list.includes(p));
  const sharedSum = SHARED_BUNDLE.reduce((s, p) => s + MONTHLY_PENCE[p], 0);
  let monthly = lines.reduce((s, l) => s + l.monthlyPence, 0);
  let bundle: { savedPence: number } | null = null;
  if (hasBundle) {
    monthly = monthly - sharedSum + SHARED_BUNDLE_PENCE;
    bundle = { savedPence: sharedSum - SHARED_BUNDLE_PENCE };
  }
  return {
    ok: true,
    lines,
    bundle,
    monthlyPence: monthly,
    launchMonthlyPence: launchOffer ? Math.round(monthly / 2) : null,
    launchMonths: launchOffer ? LAUNCH_MONTHS : 0,
  };
}

/** £15, £12.50: pounds for people, without ".00" on whole pounds. */
export function pounds(pence: number): string {
  const v = pence / 100;
  return "£" + (Number.isInteger(v) ? String(v) : v.toFixed(2));
}
