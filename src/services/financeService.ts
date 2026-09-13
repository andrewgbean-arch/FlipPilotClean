import { DATA_MODE } from "./dataMode";
import { Vehicle } from "../types/Vehicle"; // keeps TS consistent

const API_URL = "https://your-backend-url.com/api";

export async function calculateFinance(
  vehicleId: string,
  deposit: number
): Promise<{
  apr: number;
  monthly: number;
  totalPayable: number;
  lender: string;
}> {
  if (!DATA_MODE.USE_BACKEND) {
    return {
      apr: 9.9,
      monthly: 299,
      totalPayable: 18995,
      lender: "Prime Lender",
    };
  }

  const res = await fetch(`${API_URL}/finance/calc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vehicleId, deposit }),
  });

  return await res.json();
}
