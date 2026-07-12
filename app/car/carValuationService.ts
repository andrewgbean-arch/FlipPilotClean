import { CarRecord } from "./carTypes";

export function estimateMarketValue(car: CarRecord) {
  const base = 5000;
  const agePenalty = (new Date().getFullYear() - car.year) * 150;
  const mileagePenalty = car.mileage * 0.03;

  const conditionBoost =
    car.condition === "excellent" ? 1200 :
    car.condition === "good" ? 600 :
    car.condition === "fair" ? 0 :
    -500;

  const estimatedValue = Math.max(
    500,
    base - agePenalty - mileagePenalty + conditionBoost
  );

  const confidence = 0.65;

  // ⭐ FIX: status must be EXACT union type
  let status: "fair" | "undervalued" | "overpriced";

  if (estimatedValue > car.purchasePrice * 1.2) {
    status = "undervalued";
  } else if (estimatedValue < car.purchasePrice * 0.8) {
    status = "overpriced";
  } else {
    status = "fair";
  }

  return {
    estimatedValue,
    confidence,
    status,
    lastUpdated: new Date().toISOString(),
  };
}
