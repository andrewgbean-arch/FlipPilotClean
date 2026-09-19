import type { FlipRecord } from "../models/FlipRecord";

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

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Barcode and photo scans are saved into the same store as vehicles, but only
 * vehicles (manual add, MOT lookup) carry an MOT record. The Motors screens and
 * the Overview / MOT screens they open need that record.
 */
export function isVehicleRecord(record: FlipRecord): boolean {
  return !!record.mot;
}

/**
 * Profit only exists once both prices are known. Stock that has a buy price but
 * no sell price yet is not a loss, so it is left out rather than counted as one.
 */
export function realisedProfit(record: FlipRecord): number | null {
  if (record.buyPrice == null || record.sellPrice == null) return null;
  const profit = record.sellPrice - record.buyPrice;
  return Number.isFinite(profit) ? profit : null;
}

/**
 * Profit for a row in a list: what it sold for (or, while unsold, what it is
 * valued at) minus what it cost. Unknown when either side is missing, so an item
 * with no buy price never reads as a profit equal to its sell price.
 */
export function projectedProfit(record: FlipRecord): number | null {
  const sell = record.sellPrice ?? record.valuation;
  if (record.buyPrice == null || sell == null) return null;
  const profit = sell - record.buyPrice;
  return Number.isFinite(profit) ? profit : null;
}

/** Sort comparator for "largest first" that puts unknown (null) values last. */
export function compareDescending(a: number | null, b: number | null): number {
  const x = a ?? Number.NEGATIVE_INFINITY;
  const y = b ?? Number.NEGATIVE_INFINITY;
  return x === y ? 0 : y > x ? 1 : -1;
}

/** One set of Motors figures so the tab, hub and analytics screens agree. */
export function summariseVehicles(records: FlipRecord[]) {
  const vehicles = records.filter(isVehicleRecord);

  const ranked: { vehicle: FlipRecord; profit: number }[] = [];
  for (const vehicle of vehicles) {
    const profit = realisedProfit(vehicle);
    if (profit !== null) ranked.push({ vehicle, profit });
  }
  ranked.sort((a, b) => b.profit - a.profit);

  const totalProfit = ranked.reduce((sum, entry) => sum + entry.profit, 0);

  const scores = vehicles
    .map((vehicle) => vehicle.flipScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

  return { vehicles, total: vehicles.length, totalProfit, avgScore, ranked };
}

/** Realised profit per calendar month (by date added), oldest month first. */
export function monthlyProfit(
  vehicles: FlipRecord[]
): { key: string; label: string; profit: number }[] {
  const months = new Map<string, { label: string; profit: number }>();

  for (const vehicle of vehicles) {
    const profit = realisedProfit(vehicle);
    if (profit === null) continue;

    const date = new Date(vehicle.timestamp);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entry = months.get(key) ?? {
      label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      profit: 0,
    };
    entry.profit += profit;
    months.set(key, entry);
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { label, profit }]) => ({ key, label, profit }));
}

/** Bar length as a whole percentage of the track, never below 0 or above 100. */
export function barPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)));
}

/** "£1,200", "-£45.50", or "-" when there is no usable number. */
export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [whole, pence] = rounded
    .toFixed(Number.isInteger(rounded) ? 0 : 2)
    .split(".");
  const sign = value < 0 && rounded !== 0 ? "-" : "";
  return `${sign}£${groupThousands(whole)}${pence ? `.${pence}` : ""}`;
}

/** "+£1,200", "-£45.50", "£0" for nothing, or "-" when there is no usable number. */
export function formatSignedMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return formatMoney(0);
  return `${rounded > 0 ? "+" : "-"}${formatMoney(Math.abs(rounded))}`;
}

/** "62,400 mi", or "-" when there is no usable number. */
export function formatMiles(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${groupThousands(String(Math.round(Math.abs(value))))} mi`;
}

/** "72/100", or "-" when the record has no score. */
export function formatScore(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value)}/100`;
}
