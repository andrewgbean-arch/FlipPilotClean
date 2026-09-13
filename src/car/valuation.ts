export type CarInput = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: "excellent" | "good" | "average" | "poor";
  extras?: string[];
};

export type CarValuation = {
  estimatedPrice: number;
  tradeInPrice: number;
  privateSalePrice: number;
  confidence: number;
};

export function estimateCarValue(car: CarInput): CarValuation {
  const currentYear = new Date().getFullYear();

  // Base price logic (simple but expandable)
  let basePrice = 20000;

  // Age depreciation
  const age = currentYear - car.year;
  basePrice -= age * 800;

  // Mileage depreciation
  basePrice -= Math.floor(car.mileage / 10000) * 300;

  // Condition multiplier
  const conditionMultiplier = {
    excellent: 1.1,
    good: 1.0,
    average: 0.85,
    poor: 0.7,
  }[car.condition];

  basePrice *= conditionMultiplier;

  // Extras
  if (car.extras && car.extras.length > 0) {
    basePrice += car.extras.length * 150;
  }

  // Final prices
  const privateSalePrice = Math.round(basePrice);
  const tradeInPrice = Math.round(basePrice * 0.85);
  const estimatedPrice = Math.round((privateSalePrice + tradeInPrice) / 2);

  // Confidence score
  const confidence = Math.max(60, 100 - age * 2);

  return {
    estimatedPrice,
    tradeInPrice,
    privateSalePrice,
    confidence,
  };
}
