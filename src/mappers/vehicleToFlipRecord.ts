import { Vehicle } from "../types/Vehicle";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function mapVehicleToFlipRecord(v: Vehicle): FlipRecord {
  return {
    id: v.id,
    title: `${v.make} ${v.model}`,
    buyPrice: v.priceTrade,
    sellPrice: v.priceRetail,
    valuation: v.priceRetail,
    mileage: v.mileage,
    flipScore: v.supernovaScore,
    timestamp: new Date().toISOString(),
    mot: {
      motExpiry: v.mot?.expiry,
    },
  };
}
