import { POLICY, promoActive } from "../config/marketplacePolicy";
import { allowedDeviceIds } from "../middleware/sellingGate";
import { loadListings } from "../routes/publishedListings";
import { listingStatus } from "./listingStatus";
import { refund, spend } from "./creditStore";
import { checkRegistration, normaliseRegistration, type DvlaVehicle } from "./dvla";
import { fetchMotHistory, highestReading, motConfigured, summariseMot, type MotSummary } from "./dvsaMot";

/**
 * Listing a car: it has to be a real, registered car (checked with the DVLA), and once the launch
 * offer is over it costs credits.
 *
 * The registration number is kept private. Buyers see that the car was checked, and what the DVLA
 * itself says about it (make, colour, fuel, year, tax and MOT), but never the plate, so a listing
 * can't be used to publish people's number plates.
 *
 * Why the check: a listing that needs a registration the DVLA recognises, one car at a time, and that
 * another seller is not already using, is much harder to use for a scam with someone else's car.
 */

export type StoredVehicle = { registration: string; checkedAt: string; dvla: DvlaVehicle; mot: MotSummary | null };

export type Refusal = { ok: false; status: number; body: Record<string, unknown> };

const refuse = (status: number, error: string, message: string, extra: Record<string, unknown> = {}): Refusal => ({
  ok: false,
  status,
  body: { ok: false, error, message, ...extra },
});

/** The DVLA check is required on every car listing in production; CAR_DVLA_CHECK=on or off overrides. */
export function carCheckRequired(): boolean {
  const setting = (process.env.CAR_DVLA_CHECK ?? "").trim().toLowerCase();
  if (setting === "on") return true;
  if (setting === "off") return false;
  return process.env.NODE_ENV === "production";
}

/** Credits a car listing costs this phone right now: nothing during the launch offer or on a named test phone. */
export function carFee(deviceId: string): number {
  if (promoActive() || allowedDeviceIds().includes(deviceId)) return 0;
  return POLICY.carCreditCost;
}

/** "64,200", "64200 miles" and 64200 all mean 64200. Null when there is no number. */
function parseMiles(raw: unknown): number | null {
  const n = Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Odometers are read to the nearest few hundred and typed from memory: this much below the MOT is not a lie. */
const MILEAGE_TOLERANCE = 500;

const fmt = (n: number) => n.toLocaleString("en-GB");
const dateUK = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

/** The seller says "Toyota" and the DVLA says the plate is on a Ford. "VW" for "VOLKSWAGEN" is fine. */
function makesConflict(seller: unknown, dvlaMake: string | null): boolean {
  if (typeof seller !== "string" || !dvlaMake) return false;
  const a = letters(seller);
  const b = letters(dvlaMake);
  if (a.length < 4 || !b) return false;
  return !a.includes(b) && !b.includes(a);
}

/**
 * Checks the registration with the DVLA and against the other live listings.
 * `excludeListingId` is the listing being relisted, so it doesn't clash with itself.
 * Takes no credits: this only decides whether the car may be listed.
 */
export async function verifyCar(
  input: { registration: unknown; make: unknown; mileage?: unknown },
  excludeListingId?: string | number
): Promise<{ ok: true; vehicle: StoredVehicle | null } | Refusal> {
  const raw = typeof input.registration === "string" ? input.registration.trim() : "";
  const required = carCheckRequired();

  if (!raw) {
    if (required) {
      return refuse(400, "registration-required", "Enter the car's registration number. We check it with the DVLA, and buyers never see it.");
    }
    return { ok: true, vehicle: null };
  }
  const registration = normaliseRegistration(raw);
  if (!registration) {
    return refuse(400, "bad-registration", "That doesn't look like a UK registration number. Check it and try again.");
  }

  // Without a DVLA key the check can't be made: fine in development, never in production.
  if (!required && !process.env.DVLA_API_KEY) return { ok: true, vehicle: null };

  // The MOT history is asked at the same moment (it is optional: a new car has none, and if the service is
  // down the listing simply goes up without the MOT card).
  const [check, motRaw] = await Promise.all([
    checkRegistration(registration),
    motConfigured()
      ? fetchMotHistory(registration).catch((err: any) => {
          console.log("MOT history check failed:", err?.response?.status ?? err?.code ?? err?.message);
          return null;
        })
      : Promise.resolve(null),
  ]);
  if (check.status === "unavailable") {
    return refuse(503, "registration-check-unavailable", "We couldn't check the registration just now. Please try again in a few minutes. You haven't been charged.");
  }
  if (check.status === "not-found") {
    return refuse(404, "registration-not-found", "The DVLA doesn't have a vehicle with that registration. Check it and try again.");
  }

  if (makesConflict(input.make, check.vehicle.make)) {
    return refuse(
      409,
      "vehicle-mismatch",
      `That registration belongs to a ${check.vehicle.make}, but you entered ${String(input.make).trim().slice(0, 40)}. Please check the registration and the make.`
    );
  }

  const taken = loadListings().some((l: any) => {
    if (String(l.id) === String(excludeListingId ?? "")) return false;
    const status = listingStatus(l);
    return (status === "available" || status === "reserved") && l.dvlaCheck?.registration === registration;
  });
  if (taken) {
    return refuse(409, "registration-in-use", "A car with that registration is already for sale on FlipPilot. If it's yours and someone else has listed it, please contact us.");
  }

  // Mileage only goes up. If the seller's number is below what the MOT tester recorded, it is a typo or a
  // clocked car, and either way it must not go up as it is.
  const mot = summariseMot(motRaw);
  const sellerMiles = parseMiles(input.mileage);
  const top = highestReading(mot);
  if (top && sellerMiles !== null && sellerMiles < top.miles - MILEAGE_TOLERANCE) {
    return refuse(
      409,
      "mileage-below-mot",
      `The mileage you entered (${fmt(sellerMiles)}) is lower than the ${fmt(top.miles)} miles recorded at this car's MOT on ${dateUK(top.date)}. A car's mileage can't go down, so please check it. If the MOT record is wrong, contact us.`,
      { motMiles: top.miles, motDate: top.date }
    );
  }

  return { ok: true, vehicle: { registration, checkedAt: new Date().toISOString(), dvla: check.vehicle, mot } };
}

/**
 * Takes the credits for a car listing, all in one step. Nothing is taken during the launch offer.
 * Must be called immediately before the listing is saved, with nothing awaited in between.
 */
export function payForCar(
  account: { id: string } | null | undefined,
  deviceId: string
): { ok: true; charged: number; accountId: string | null } | Refusal {
  const fee = carFee(deviceId);
  if (fee === 0) return { ok: true, charged: 0, accountId: null };
  if (!account) return refuse(401, "sign-in-required", "Please sign in with your email to list a car.");

  const paid = spend(account.id, fee, "car-listing");
  if (!paid.ok) {
    return refuse(402, "credits-required", `Listing a car costs ${fee} credits and you have ${paid.balance}.`, {
      credits: paid.balance,
      needed: fee,
    });
  }
  return { ok: true, charged: fee, accountId: account.id };
}

/** Puts the credits back if the listing could not be saved after they were taken. */
export function refundCar(paid: { charged: number; accountId: string | null }) {
  if (paid.charged > 0 && paid.accountId) refund(paid.accountId, paid.charged, "refund");
}
