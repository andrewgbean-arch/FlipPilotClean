/**
 * How a scan result describes the profit it shows, and whether it may show an ROI.
 *
 * The buy price on a fresh result is not something anyone has paid: it is the app's suggestion, a fixed share
 * of the sell price (half, for a charity shop; 35% at a car boot, 65% in a shop or online). So "Estimated profit
 * +£255.00, ROI +100.0%" on every single scan was a formula's answer, not a measure of the item, and it made
 * every item look like a perfect double. (Found 2026-10-18 on the owner's phone, five scans in a row all +100.0%.)
 *
 * So until the person types in what they would really pay (or say what they did pay), the profit is worded as
 * what it is, "if you buy at £X", with a line saying which assumption that is, and no ROI is shown. Once the
 * buy price is theirs the profit is theirs too, and the ROI appears.
 */
export type ProfitFraming = {
  /** The small label over the big profit figure. */
  heading: string;
  /** Whether the ROI pill may be shown: only for a buy price the person set themselves. */
  showRoi: boolean;
  /** A line saying which assumption the figure rests on, or null when there is nothing to add. */
  note: string | null;
  /** The whole thing as one sentence for a screen reader, figure first. */
  spoken: string;
};

const money = (n: number) => `£${Math.abs(n).toFixed(2)}`;

export function profitFraming(input: {
  buy: number | null;
  sell: number | null;
  /** True when the buy price was typed in (or is what they paid), false when it is the app's suggestion. */
  buyIsTheirs: boolean;
  /** The "Where are you buying?" choice behind the suggestion, e.g. "Charity shop", and its share of the sell price. */
  sourceLabel?: string | null;
  sourceShare?: number | null;
}): ProfitFraming {
  const { buy, sell, buyIsTheirs } = input;
  if (buy == null || sell == null || !Number.isFinite(buy) || !Number.isFinite(sell)) {
    return { heading: "Estimated profit", showRoi: false, note: null, spoken: "Estimated profit not available yet" };
  }
  const noun = sell - buy < 0 ? "Loss" : "Profit";
  const figure = money(sell - buy);
  if (buyIsTheirs) {
    return {
      heading: `${noun} at your price of ${money(buy)}`,
      showRoi: true,
      note: null,
      spoken: `${noun} of ${figure} at your price of ${money(buy)}`,
    };
  }
  const assumed =
    input.sourceLabel && typeof input.sourceShare === "number" && Number.isFinite(input.sourceShare)
      ? `Assumes a ${input.sourceLabel.toLowerCase()} price (${Math.round(input.sourceShare * 100)}% of the sell price). `
      : "";
  return {
    heading: `${noun} if you buy at ${money(buy)}`,
    showRoi: false,
    note: `${assumed}Tap Buy to enter what you'd really pay.`,
    spoken: `${noun} of ${figure} if you buy at ${money(buy)}`,
  };
}
