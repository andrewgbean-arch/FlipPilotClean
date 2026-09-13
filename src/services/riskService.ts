import { DATA_MODE } from "./dataMode";
import { ultraInventory } from "../dealer/ultraInventory";
import { Vehicle } from "../types/Vehicle";

const API_URL = "https://your-backend-url.com/api";

export async function getRiskScore(vehicleId: string): Promise<number> {
  if (!DATA_MODE.USE_BACKEND) {
    const v = ultraInventory.find((v: Vehicle) => v.id === vehicleId);
    return v?.riskScore ?? 0;
  }

  const res = await fetch(`${API_URL}/risk/${vehicleId}`);
  return await res.json();
}
