import { DATA_MODE } from "./dataMode";

import { ultraInventory } from "../dealer/ultraInventory";
import { Vehicle } from "../types/Vehicle";

const API_URL = "https://your-backend-url.com/api"; // change to your backend

export async function getVehicles(): Promise<Vehicle[]> {
  if (!DATA_MODE.USE_BACKEND) {
    return ultraInventory;
  }

  const res = await fetch(`${API_URL}/vehicles`);
  return await res.json();
}

export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
  if (!DATA_MODE.USE_BACKEND) {
    return ultraInventory.find((v: Vehicle) => v.id === id);
  }

  const res = await fetch(`${API_URL}/vehicles/${id}`);
  return await res.json();
}
