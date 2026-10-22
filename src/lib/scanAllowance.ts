// What this person has for scanning, as the server's GET /credits tells it, and the words the app puts to it.
// Kept free of React Native so it can be checked on its own (see src/utils/checks/scanAllowance.check.ts).
//
// The plan (chosen 22 Oct 2026): FlipPilot is free to use. You sign up (an email and a one-time code) and get 100 free scans
// a month; Pro (4.99 a month) is unlimited with a fair-use ceiling a day, and adds a shop-price check on pricier items and
// export to eBay. Credit packs are no longer sold, though credits someone already holds still work.

/** What the server is assumed to give when it does not say (it always does). */
export const FREE_SCANS_A_MONTH = 100;
export const PRO_DAILY_SCANS = 150;
/** Shown until the store says the real price. */
export const PRO_PRICE = "£4.99";

export type ScanAllowance = {
  /** False when the server isn't applying limits (development), so there is nothing to show. */
  metering: boolean;
  signedIn: boolean;
  /** Signing up is how you scan: the server gives a phone with no account no free scans. */
  accountRequired: boolean;
  /** Scan credits held from before the packs were retired (they also pay for boosts and Nightglass chapters). */
  credits: number;
  freeLeft: number;
  freeLimit: number;
  /** What signing in gives each month. */
  signedInFreeLimit: number;
  /** The date (YYYY-MM-DD) the free scans start again. */
  resetsOn: string;
  /** On the Pro plan, as the server (asking RevenueCat itself) says; and the date it renews. */
  pro: boolean;
  proRenewsOn: string | null;
  /** Pro's fair-use ceiling of scans a day. */
  proDailyLimit: number;
  /** Credit packs on sale: the store product id and how many credits it gives. Empty now, unless the server brings them back. */
  packs: { productId: string; credits: number }[];
};

const finite = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const positive = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Reads the server's reply to GET /credits. Null when it isn't a usable answer. */
export function parseScanAllowance(json: any): ScanAllowance | null {
  if (!json?.ok || !json.free) return null;
  return {
    metering: !!json.metering,
    signedIn: !!json.signedIn,
    accountRequired: json.accountRequired === true,
    credits: finite(json.credits, 0),
    freeLeft: finite(json.free.left, 0),
    // 0 is a real answer for a phone that is not signed in, so it is not swapped for a default.
    freeLimit: finite(json.free.limit, 0),
    signedInFreeLimit: positive(json.signedInFreeLimit, FREE_SCANS_A_MONTH),
    resetsOn: String(json.free.resetsOn ?? ""),
    pro: json.plan?.active === true,
    proRenewsOn: typeof json.plan?.renewsOn === "string" ? json.plan.renewsOn : null,
    proDailyLimit: positive(json.proDailyLimit, PRO_DAILY_SCANS),
    packs: Array.isArray(json.packs) ? json.packs.filter((p: any) => typeof p?.productId === "string" && Number(p.credits) > 0) : [],
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-01" (or a full ISO date) as "1 November". Empty when it is not a date. */
export function dateInWords(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month}` : "";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A phone with no account where an account is what lets you scan. */
export const needsSignUp = (a: ScanAllowance) => a.accountRequired && !a.signedIn;

/** The short line on the scan-allowance pill: how many scans are left, so running out is never a surprise. */
export function scanAllowanceWords(a: ScanAllowance): string {
  if (a.pro) return "Pro: unlimited scans";
  if (needsSignUp(a)) return "Sign in to start scanning";
  if (a.freeLeft > 0) return `${plural(a.freeLeft, "free scan")} left`;
  if (a.signedIn && a.credits > 0) return `${plural(a.credits, "credit")} left`;
  // Anonymous scans switched on at the server (testing): signing in is the way to more.
  if (!a.signedIn) return "Sign in for more scans";
  return "Out of free scans";
}

/** True when the person has nothing left to scan with (the pill turns red). Signing up is an invitation, not a warning. */
export function scanAllowanceIsEmpty(a: ScanAllowance): boolean {
  if (a.pro || needsSignUp(a)) return false;
  return a.freeLeft <= 0 && !(a.signedIn && a.credits > 0);
}

/** The line under "Scans" in Settings and on the allowance screen. */
export function scanAllowanceSummary(a: ScanAllowance): string {
  if (a.pro) return `Pro: unlimited scans (up to ${a.proDailyLimit} a day)`;
  if (needsSignUp(a)) return `Sign in free to get ${a.signedInFreeLimit} scans a month`;
  const base = `${a.freeLeft} of ${a.freeLimit} free scans left this month`;
  return a.signedIn && a.credits > 0 ? `${base}, and ${plural(a.credits, "scan credit")}` : base;
}

/** The line under "Your plan" in Settings. `price` is the store's own price when it is known. */
export function planSubtitle(a: ScanAllowance | null, isPro: boolean, price: string = PRO_PRICE): string {
  if (isPro || a?.pro) {
    return `Unlimited scans (up to ${a?.proDailyLimit ?? PRO_DAILY_SCANS} a day), shop-price checks on pricier items and eBay export`;
  }
  const free = a?.signedInFreeLimit ?? FREE_SCANS_A_MONTH;
  if (a && needsSignUp(a)) return `Sign in free for ${free} scans a month. Go Pro (${price} a month) for unlimited`;
  return `${free} free scans a month. Go Pro (${price} a month) for unlimited`;
}

/** Which of these stopped a scan (the server's own words are in the error's message). */
export type QuotaReason = "sign-in" | "out-of-scans" | "daily-limit" | "out-of-credits";

/**
 * Reads a refused scan: the server's `error` code and whether the phone was signed in. Null when it is not a refusal for
 * running out. "free-scan-limit" is what the server says to a phone that is not signed in (and what older servers said to
 * everyone), so it is told apart by `signedIn`.
 */
export function quotaReasonOf(payload: { error?: unknown; signedIn?: unknown } | null | undefined): QuotaReason | null {
  switch (payload?.error) {
    case "free-scan-limit":
      return payload.signedIn === false ? "sign-in" : "out-of-scans";
    case "out-of-scans":
      return "out-of-scans";
    case "pro-daily-limit":
      return "daily-limit";
    case "out-of-credits":
      return "out-of-credits";
    default:
      return null;
  }
}

export type QuotaAlertContent = {
  title: string;
  /** `to` is the screen the button opens; no `to` just closes the alert. */
  buttons: { label: string; to?: "/sign-in" | "/upgrade" }[];
};

/** What to offer when a scan is refused for running out: sign in, go Pro, or (for the daily ceiling) just wait. */
export function quotaAlertContent(reason: QuotaReason | undefined | null): QuotaAlertContent {
  switch (reason) {
    case "sign-in":
      return { title: "Sign in to start scanning", buttons: [{ label: "Not now" }, { label: "Sign in", to: "/sign-in" }] };
    case "daily-limit":
      return { title: "That's today's limit", buttons: [{ label: "OK" }] };
    default:
      return { title: "You're out of free scans", buttons: [{ label: "Not now" }, { label: "Go Pro", to: "/upgrade" }] };
  }
}
