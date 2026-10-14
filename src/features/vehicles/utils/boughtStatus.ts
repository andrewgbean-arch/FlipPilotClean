import type { FlipRecord } from "../models/FlipRecord";
import { getProfit, hasProfit } from "./flipMoney";

/**
 * Which saved items the person actually BOUGHT, and so which profit figures are real.
 *
 * Saving a scan records what the item is WORTH, not that anyone bought it. The profit totals used to add
 * up every saved scan's estimated profit, as if everything scanned had been bought, so "Total profit"
 * was a total of things that might never have been bought. Now only items the person has confirmed
 * buying (and what they paid) count.
 */

export type BoughtState = "bought" | "not-bought" | "unconfirmed";

/**
 * - bought:      they said so (`bought: true`), and `buyPrice` is what they paid.
 * - not-bought:  they said they didn't (`bought: false`).
 * - unconfirmed: they never said. This is every scan saved before the question existed, and anything
 *                saved with the heart. Not counted until they answer.
 *
 * Two things are taken as bought even if never asked, because they can only be: a vehicle entered
 * through the Motors screens (it carries an MOT record, and its prices were typed in by the person), and
 * anything already marked sold (you can't have sold what you never had).
 */
export function boughtState(flip: FlipRecord): BoughtState {
  if (flip.bought === true) return "bought";
  if (flip.bought === false) return "not-bought";
  if (flip.mot || flip.sellDate) return "bought";
  return "unconfirmed";
}

export const isBought = (flip: FlipRecord) => boughtState(flip) === "bought";

export interface ProfitSummary {
  /** Profit across the items that were bought. Never includes anything unconfirmed or not bought. */
  total: number;
  /** How many items were bought (and so are in the total). */
  bought: number;
  /** How many have not been answered yet (not in the total). */
  unconfirmed: number;
  /** How many the person decided not to buy (not in the total). */
  notBought: number;
}

export function profitSummary(flips: FlipRecord[]): ProfitSummary {
  const summary: ProfitSummary = { total: 0, bought: 0, unconfirmed: 0, notBought: 0 };
  for (const flip of flips) {
    switch (boughtState(flip)) {
      case "bought":
        summary.bought += 1;
        summary.total += getProfit(flip);
        break;
      case "not-bought":
        summary.notBought += 1;
        break;
      default:
        summary.unconfirmed += 1;
    }
  }
  return summary;
}

/** The bought item with the biggest known profit, or null when none has a profit figure. */
export function bestBoughtFlip(flips: FlipRecord[]): FlipRecord | null {
  let best: FlipRecord | null = null;
  for (const flip of flips) {
    if (!isBought(flip) || !hasProfit(flip)) continue;
    if (best === null || getProfit(flip) > getProfit(best)) best = flip;
  }
  return best;
}

/** The most that can be typed as a price paid; anything above it is a typing slip, not a purchase. */
export const MAX_PAID_PRICE = 1_000_000;

/**
 * What the person typed as the price they paid, as a number of pounds, or null if it isn't one.
 * Accepts "£12.50", "12.5", "7", "0" (it was free), and "1,250.50". A comma followed by one or two digits
 * at the very end ("12,50") is taken as a decimal comma, not as a thousand: 12.50, never 1,250.
 */
export function parsePaidPrice(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  let cleaned = text.replace(/[£\s]/g, "");
  if (cleaned === "") return null;

  if (/^\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");

  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > MAX_PAID_PRICE) return null;
  return Math.round(value * 100) / 100;
}

/** The change to save when the person confirms they bought it for `paid`. */
export function boughtPatch(paid: number, now: Date = new Date()): Partial<FlipRecord> {
  return { bought: true, buyPrice: Math.round(paid * 100) / 100, buyDate: now.toISOString() };
}

/** The change to save when the person says they didn't buy it. */
export function notBoughtPatch(): Partial<FlipRecord> {
  return { bought: false };
}
