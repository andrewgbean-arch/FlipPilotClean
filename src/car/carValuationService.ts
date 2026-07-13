import { CarRecord } from "./carTypes";
export function estimateMarketValue(input: {
  make: string;
  model: string;
  year: number;
  mileage: number;
  purchasePrice: number;
  condition?: "poor" | "fair" | "good" | "excellent";
}) {
  const base = 5000;
  const agePenalty = (new Date().getFullYear() - input.year) * 150;
  const mileagePenalty = input.mileage * 0.03;

  const conditionBoost =
    input.condition === "excellent" ? 1200 :
    input.condition === "good" ? 600 :
    input.condition === "fair" ? 0 :
    -500;

  const estimatedValue = Math.max(
    500,
    base - agePenalty - mileagePenalty + conditionBoost
  );

  const confidence = 0.65;

  let status: "fair" | "undervalued" | "overpriced";

  if (estimatedValue > input.purchasePrice * 1.2) {
    status = "undervalued";
  } else if (estimatedValue < input.purchasePrice * 0.8) {
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


