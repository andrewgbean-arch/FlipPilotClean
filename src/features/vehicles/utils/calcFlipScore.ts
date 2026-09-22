import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { daysUntilDate, motExpiryOf } from "@/features/vehicles/utils/motDates";

export function calcFlipScore(vehicle: FlipRecord): number {
  let score = 0;

  // Profit (0–30)
  const buy = vehicle.buyPrice || 0;
  const sell = vehicle.sellPrice || 0;
  const profit = sell - buy;
  if (profit > 0) score += Math.min(30, profit / 50);

  // ROI (0–20)
  const roi = buy > 0 ? ((sell - buy) / buy) * 100 : 0;
  score += Math.min(20, roi / 5);

  // AI Confidence (0–10), the real scanned-item price-estimate confidence,
  // stored on a 0–100 scale.
  const confidence = vehicle.aiPriceConfidence;
  if (confidence != null && Number.isFinite(confidence)) {
    score += Math.max(0, Math.min(10, confidence / 10));
  }

  // Market Demand (0–15). A typed-in value that isn't a number must not turn
  // the whole score into NaN.
  const demand = vehicle.market?.demandScore;
  if (demand != null && Number.isFinite(demand)) {
    score += Math.min(15, demand / 2);
  }

  // MOT Status (0–10). Judged from the expiry date; the stored status text is
  // only used when there is no usable date.
  const motDays = daysUntilDate(motExpiryOf(vehicle));
  if (motDays !== null) {
    score += motDays >= 0 ? 10 : -5;
  } else {
    if (vehicle.mot?.motStatus === "Valid") score += 10;
    if (vehicle.mot?.motStatus === "Expired") score -= 5;
  }

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}
