import type { FlipRecord } from "../models/FlipRecord";

/**
 * The buy, sell and profit figures of a saved flip, read the one way every screen agrees on.
 * (Kept in a plain file, apart from the card component that first held them, so they can be checked
 * and used by anything that totals profit.)
 *
 * Buy/sell/profit live at the top level of a record, and that is where edits write them (a cleared
 * price is stored as null). `pricing` only holds the original scan estimate, so it is used only for a
 * record with no top-level prices at all.
 */
const hasOwnPrices = (f: FlipRecord) => f.buyPrice != null || f.sellPrice != null || f.profit != null;
const rawBuy = (f: FlipRecord) => (hasOwnPrices(f) ? f.buyPrice : f.pricing?.recommendedBuyPrice);
const rawSell = (f: FlipRecord) => (hasOwnPrices(f) ? f.sellPrice : f.pricing?.recommendedSellPrice);
const rawProfit = (f: FlipRecord) => (hasOwnPrices(f) ? f.profit : f.pricing?.predictedProfit);

export const getBuyPrice = (f: FlipRecord) => Number(rawBuy(f) ?? 0);
export const getSellPrice = (f: FlipRecord) => Number(rawSell(f) ?? 0);
export const getProfit = (f: FlipRecord) => Number(rawProfit(f) ?? 0);

// getProfit counts a missing figure as 0 so totals still add up. These say
// whether there was a real figure, so a card can show "-" instead of £0.00.
export const hasBuyPrice = (f: FlipRecord) => rawBuy(f) != null;
export const hasSellPrice = (f: FlipRecord) => rawSell(f) != null;
export const hasProfit = (f: FlipRecord) => rawProfit(f) != null;
