import { CarRecord } from "./carTypes";

export async function generateAiSummary(
  car: CarRecord
): Promise<CarRecord["aiSummary"]> {
  return {
    summary: `This ${car.make} ${car.model} shows good flip potential.`,
    riskLevel: "medium",
    demandScore: 72,
    recommendedSalePrice: car.purchasePrice * 1.25,
    lastUpdated: new Date().toISOString(),
  };
}
