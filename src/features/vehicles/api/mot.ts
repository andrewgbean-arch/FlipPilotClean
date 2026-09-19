// src/features/vehicles/api/mot.ts
import { BASE_URL } from "@/utils/api";

export interface MOTData {
  reg: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  colour?: string | null;
  mileage?: number | null;
  expiry?: string | null;
  motExpiry?: string | null;
  taxStatus?: string | null;
  advisories?: string[];
  failures?: string[];
}

/**
 * Fetch merged DVLA + MOT data from the real backend (backend/server.ts's
 * `GET /vehicle?reg=` route — DVSA MOT History API + DVLA vehicle enquiry).
 */
export async function fetchMOT(reg: string): Promise<MOTData | null> {
  // The DVLA and DVSA lookups want the plate without spaces, in capitals.
  const plate = reg.replace(/\s+/g, "").toUpperCase();
  if (!plate) return null;

  try {
    const response = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(plate)}`);
    const data = await response.json();

    if (!data.ok || !data.vehicle) {
      return null;
    }

    const v = data.vehicle;

    return {
      reg: plate,
      make: v.make ?? null,
      model: v.model ?? null,
      year: v.year ?? null,
      colour: v.colour ?? null,
      mileage: v.mileage ?? null,
      expiry: v.motExpiry ?? null,
      motExpiry: v.motExpiry ?? null,
      taxStatus: v.taxStatus ?? null,
      advisories: v.advisories?.map((a: any) => a.text ?? String(a)) ?? [],
      failures: v.failures?.map((f: any) => f.text ?? String(f)) ?? [],
    };
  } catch (err) {
    console.log("MOT/DVLA lookup failed:", err);
    return null;
  }
}
