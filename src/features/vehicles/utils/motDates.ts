import type { FlipRecord } from "../models/FlipRecord";

// MOT and tax dates are stored as YYYY-MM-DD strings (from the DVSA/DVLA lookup
// or typed by hand). They are calendar days, not moments in time, so they are
// compared as days on the phone's own calendar. That keeps an MOT valid for the
// whole of its expiry day instead of expiring at midnight UTC.

const DAY_MS = 86400000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Whole days since 1970-01-01 for a calendar date, or null if it is not a real date. */
function toDayNumber(year: number, month: number, day: number): number | null {
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms / DAY_MS;
}

/** Reads YYYY-MM-DD (optionally followed by a time) or DD/MM/YYYY. */
function parseDayNumber(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(text);
  if (iso) return toDayNumber(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const uk = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (uk) return toDayNumber(Number(uk[3]), Number(uk[2]), Number(uk[1]));

  return null;
}

/**
 * Whole calendar days from today until the date: 0 is today, negative is in the
 * past. Null when the text is not a readable date.
 */
export function daysUntilDate(
  value: string | null | undefined,
  now: Date = new Date()
): number | null {
  const target = parseDayNumber(value);
  if (target === null) return null;
  const today =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
  return target - today;
}

/** "18 Sep 2026", or the original text when it is not a readable date. */
export function formatDate(value: string | null | undefined): string {
  if (typeof value !== "string") return "-";
  const dayNumber = parseDayNumber(value);
  if (dayNumber === null) return value.trim() || "-";
  const date = new Date(dayNumber * DAY_MS);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** The expiry date on a record, preferring motExpiry and skipping blank strings. */
export function motExpiryOf(vehicle: Pick<FlipRecord, "mot">): string | null {
  const mot = vehicle.mot;
  if (!mot) return null;
  for (const candidate of [mot.motExpiry, mot.expiryDate]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return null;
}

/** Days until the MOT runs out (negative once it has), or null when unknown. */
export function motDaysLeft(vehicle: Pick<FlipRecord, "mot">): number | null {
  return daysUntilDate(motExpiryOf(vehicle));
}

/** Reads as "expires in 12 days", "expires today" or "expired 3 days ago". */
export function motExpiryPhrase(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return "expiry date unknown";
  if (days < 0) {
    const ago = -days;
    return `expired ${ago} ${ago === 1 ? "day" : "days"} ago`;
  }
  if (days === 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}

/** Vehicles whose MOT has expired or runs out within the window, most urgent first. */
export function motAttentionList<T extends Pick<FlipRecord, "mot">>(
  vehicles: T[],
  withinDays = 30
): { vehicle: T; days: number }[] {
  const due: { vehicle: T; days: number }[] = [];
  for (const vehicle of vehicles) {
    const days = motDaysLeft(vehicle);
    if (days !== null && days <= withinDays) due.push({ vehicle, days });
  }
  return due.sort((a, b) => a.days - b.days);
}
