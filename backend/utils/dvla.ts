import axios from "axios";

/**
 * Is this a real UK registration? Asks the DVLA's Vehicle Enquiry Service (the same one the vehicle
 * lookup uses) and returns the facts it holds: make, colour, fuel, year, tax and MOT status.
 *
 * The answer is one of:
 *   found        the DVLA knows the vehicle
 *   not-found    the DVLA has no such vehicle (or says it isn't a valid registration)
 *   unavailable  the check could not be made (no key set, the service is down, it timed out)
 *
 * "unavailable" is NOT "not found": a listing must never be refused, or a credit taken, because the
 * DVLA was having a bad minute.
 */

export type DvlaVehicle = {
  make: string | null;
  colour: string | null;
  fuelType: string | null;
  yearOfManufacture: number | null;
  taxStatus: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
};

export type RegistrationCheck =
  | { status: "found"; vehicle: DvlaVehicle }
  | { status: "not-found" }
  | { status: "unavailable" };

/** "ab12 cde" becomes "AB12CDE". Null if it can't be a UK registration. */
export function normaliseRegistration(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const reg = raw.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{2,8}$/.test(reg) && /[A-Z]/.test(reg) && /[0-9]/.test(reg) ? reg : null;
}

const text = (v: unknown, max = 40): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function checkRegistration(registration: string): Promise<RegistrationCheck> {
  const key = process.env.DVLA_API_KEY;
  if (!key) return { status: "unavailable" };
  const url =
    process.env.DVLA_API_URL || "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

  try {
    const res = await axios.post(
      url,
      { registrationNumber: registration },
      {
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        timeout: 6000,
        // 400 = not a valid registration, 404 = no such vehicle: real answers, not faults.
        validateStatus: (status) => status === 200 || status === 400 || status === 404,
      }
    );
    if (res.status !== 200) return { status: "not-found" };

    const d = res.data ?? {};
    const year = Number(d.yearOfManufacture);
    return {
      status: "found",
      vehicle: {
        make: text(d.make),
        colour: text(d.colour),
        fuelType: text(d.fuelType),
        yearOfManufacture: Number.isInteger(year) && year > 1900 && year < 2100 ? year : null,
        taxStatus: text(d.taxStatus),
        motStatus: text(d.motStatus),
        motExpiryDate: text(d.motExpiryDate, 10),
      },
    };
  } catch (err: any) {
    console.log("DVLA registration check failed:", err?.response?.status ?? err?.code ?? err?.message);
    return { status: "unavailable" };
  }
}
