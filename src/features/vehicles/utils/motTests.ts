/**
 * One MOT test as the server sends it (see backend/utils/dvsaMot.ts, motTestList): the day, pass or fail, the
 * miles and what the tester wrote down. Kept on a vehicle so the whole history can be shown, not just the
 * latest test.
 */
export type MotTestEntry = {
  /** YYYY-MM-DD */
  date: string;
  result: "PASSED" | "FAILED";
  miles: number | null;
  expiryDate: string | null;
  failures: string[];
  advisories: string[];
  minor: string[];
  /** Faults found and fixed during the test itself. */
  repaired: string[];
};

const texts = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/** Anything the server sent, cleaned into a list that is safe to show. Nothing valid in gives an empty list. */
export function parseMotTests(raw: unknown): MotTestEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any): MotTestEntry | null => {
      if (typeof t?.date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(t.date)) return null;
      const miles = typeof t.miles === "number" && Number.isFinite(t.miles) && t.miles > 0 ? Math.round(t.miles) : null;
      return {
        date: t.date.slice(0, 10),
        result: String(t.result ?? "").toUpperCase().startsWith("F") ? "FAILED" : "PASSED",
        miles,
        expiryDate: typeof t.expiryDate === "string" && t.expiryDate ? t.expiryDate.slice(0, 10) : null,
        failures: texts(t.failures),
        advisories: texts(t.advisories),
        minor: texts(t.minor),
        repaired: texts(t.repaired),
      };
    })
    .filter((t): t is MotTestEntry => t !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The mileage points for the timeline: one per test that has a reading, oldest first. */
export function mileageHistoryFromTests(tests: MotTestEntry[]): { date: string; mileage: number }[] {
  return tests
    .filter((t) => t.miles != null)
    .map((t) => ({ date: t.date, mileage: t.miles as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** "Valid" or "Expired" from an expiry date, or "Unknown" when there is none. */
export function motStatusFromExpiry(expiry: string | null | undefined, now = Date.now()): string {
  if (!expiry) return "Unknown";
  const end = new Date(`${expiry.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return "Unknown";
  return end.getTime() >= now ? "Valid" : "Expired";
}
