/**
 * The low-to-high track drawn under "Fair market price" on a scan result.
 *
 * Its two ends used to be eBay's cheapest and dearest listings, while the price above it is a blend of eBay,
 * Google and the AI's own estimate, and nothing checked that the price sat inside the track. When eBay's search
 * caught parts and extras (brake sets, a seat post, tyres and a catalogue beside an electric mountain bike) the
 * track read £40 to £165 under a £510 price, with the marker pinned off the end of it.
 *
 * So the track must HOLD the price it sits under. eBay's range is used when it does, the AI's own range when
 * that does, and otherwise no track is drawn: a missing track is honest, a track around the wrong numbers is not.
 * With no price to compare against there is nothing to contradict, so the first usable range is kept as before.
 */
export type PriceRange = { low: number; high: number };

// A price a little outside the ends (rounding, a listing or two either side) still counts as inside.
export const RANGE_TOLERANCE = 0.1;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function pickPriceRange(input: {
  low?: unknown;
  high?: unknown;
  aiLow?: unknown;
  aiHigh?: unknown;
  fair?: unknown;
}): PriceRange | null {
  const fair = num(input.fair);
  const candidates: PriceRange[] = [];
  for (const [l, h] of [
    [num(input.low), num(input.high)],
    [num(input.aiLow), num(input.aiHigh)],
  ] as const) {
    if (l != null && h != null && h > l) candidates.push({ low: l, high: h });
  }
  const holds = (r: PriceRange) =>
    fair == null || (fair >= r.low * (1 - RANGE_TOLERANCE) && fair <= r.high * (1 + RANGE_TOLERANCE));
  return candidates.find(holds) ?? null;
}
