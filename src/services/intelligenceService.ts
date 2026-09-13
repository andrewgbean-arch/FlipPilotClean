import { DATA_MODE } from "./dataMode";
import { ultraInventory } from "../dealer/ultraInventory";
import { Vehicle } from "../types/Vehicle";

const API_URL = "https://your-backend-url.com/api";

export async function getIntelligence(vehicleId: string) {
  if (!DATA_MODE.USE_BACKEND) {
    const v = ultraInventory.find((v: Vehicle) => v.id === vehicleId);

    return {
      marketHeat: v?.marketHeat,
      supernovaScore: v?.supernovaScore,
      flipDifficulty: v?.flipDifficulty,
      valuationConfidence: v?.valuationConfidence,
    };
  }

  const res = await fetch(`${API_URL}/intelligence/${vehicleId}`);
  return await res.json();
}
