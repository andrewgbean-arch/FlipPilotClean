import { BASE_URL } from "./api";

export type VehicleCondition = "excellent" | "good" | "fair" | "poor";

export type VehiclePriceResult =
  | {
      ok: true;
      estimatedValue: number;
      range: { min: number; max: number };
      baseline: number;
      comparableCount: number;
      comparables: { title: string; price: number; url: string | null }[];
      confidence: "low" | "medium" | "high";
      notes: string[];
    }
  | { ok: false; error: string; message: string };

export async function estimateVehiclePrice(input: {
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  condition: VehicleCondition;
  motAdvisoryCount: number;
  motFailureCount: number;
}): Promise<VehiclePriceResult> {
  try {
    const res = await fetch(`${BASE_URL}/vehicle-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      error: "offline",
      message: "Couldn't reach the FlipPilot server. Check your connection and try again.",
    };
  }
}
