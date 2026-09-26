// src/features/vehicles/api/mot.ts
import { BASE_URL } from "@/utils/api";
import { parseMotTests, type MotTestEntry } from "../utils/motTests";

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
  /** The DVLA's own word ("Valid", "Not valid"...), when it sent one. */
  motStatus?: string | null;
  advisories?: string[];
  failures?: string[];
  /** Every MOT test with its result, miles and notes, newest first. */
  tests?: MotTestEntry[];
}

// Either the vehicle, or a message that is safe to show the user.
export type MotLookup =
  | { data: MOTData; error: null }
  | { data: null; error: string };

const LOOKUP_TIMEOUT_MS = 20_000;

// DVLA sends "FORD", "FIESTA", "BLUE". Show "Ford", "Fiesta", "Blue". Short
// words stay in capitals (BMW, MG, GTI, TDI) when `keepShort` is set, which suits
// makes and models but not colours.
export function tidyName(value: unknown, keepShort = false): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\s-]+/g, (word) =>
      keepShort && word.length <= 3
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    );
}

const GENERIC_ERROR =
  "Couldn't look up that registration. Check the number and your connection, then try again.";

/**
 * Fetch merged DVLA + MOT data from the real backend (backend/server.ts's
 * `GET /vehicle?reg=` route — DVSA MOT History API + DVLA vehicle enquiry).
 *
 * The server words its own errors for the user ("no vehicle with that
 * registration" is not the same as "the lookup isn't responding"), so they are
 * passed through instead of being replaced by one fixed message.
 */
export async function fetchMOT(reg: string): Promise<MotLookup> {
  // The DVLA and DVSA lookups want the plate without spaces, in capitals.
  const plate = reg.replace(/\s+/g, "").toUpperCase();
  if (!plate) return { data: null, error: "Enter a registration first." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(plate)}`, {
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);

    if (!body || !body.ok || !body.vehicle) {
      return {
        data: null,
        error: typeof body?.error === "string" && body.error ? body.error : GENERIC_ERROR,
      };
    }

    const v = body.vehicle;

    return {
      data: {
        reg: plate,
        make: tidyName(v.make, true),
        model: tidyName(v.model, true),
        year: v.year ?? null,
        colour: tidyName(v.colour),
        mileage: v.mileage ?? null,
        expiry: v.motExpiry ?? null,
        motExpiry: v.motExpiry ?? null,
        taxStatus: v.taxStatus ?? null,
        motStatus: typeof v.motStatus === "string" && v.motStatus ? v.motStatus : null,
        tests: parseMotTests(v.motTests),
        advisories: v.advisories?.map((a: any) => a.text ?? String(a)) ?? [],
        failures: v.failures?.map((f: any) => f.text ?? String(f)) ?? [],
      },
      error: null,
    };
  } catch (err) {
    console.log("MOT/DVLA lookup failed:", err);
    return {
      data: null,
      error: controller.signal.aborted
        ? "The lookup took too long. Check your connection and try again."
        : "Couldn't reach the FlipPilot server. Check your connection and try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}
