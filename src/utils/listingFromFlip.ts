import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  CONDITION_OPTIONS,
  fieldsFor,
  matchCategory,
} from "@/constants/marketplaceCategories";

export type ListingDraft = {
  photos: string[];
  title: string;
  price: string;
  description: string;
  category: string | null;
  details: Record<string, string>;
};

/** "Like New" from a scan, "like new" in the picker — same thing. */
function matchCondition(named: string | null | undefined): string | null {
  const wanted = String(named ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return CONDITION_OPTIONS.find((o) => o.toLowerCase() === wanted) ?? null;
}

/** The price to open at: what the flip reckoned it would sell for. */
function suggestedPrice(flip: FlipRecord): string {
  const candidates = [
    flip.sellPrice,
    flip.pricing?.recommendedSellPrice,
    flip.market?.average,
    flip.market?.smartPrice,
    flip.aiPriceMax,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return String(Math.round(n));
  }
  return "";
}

/**
 * A saved flip, turned into the start of a listing: its photo, its title, what
 * it was reckoned to sell for, and whatever the scan already knew. Nothing is
 * invented — a field the flip has nothing for is left empty for the seller.
 */
export function listingFromFlip(flip: FlipRecord): ListingDraft {
  // A record from the vehicle flows carries a registration, so it is a vehicle
  // whatever its title says. Otherwise go on what the scan called it.
  const category = flip.mot?.reg
    ? "motors"
    : matchCategory(flip.category)?.id ?? matchCategory(flip.title)?.id ?? null;

  const details: Record<string, string> = {};

  const condition = matchCondition(flip.ai?.condition);
  if (condition) details.condition = condition;

  if (category === "motors" && flip.mot) {
    if (flip.mot.make) details.make = String(flip.mot.make);
    if (flip.mot.model) details.model = String(flip.mot.model);
    if (flip.mot.year) details.year = String(flip.mot.year);

    const mileage = flip.mileage ?? flip.mot.mileage;
    if (mileage != null) details.mileage = String(mileage);

    const motUntil = flip.mot.motExpiry ?? flip.mot.expiryDate;
    if (motUntil) details.motExpiry = String(motUntil);
    if (flip.mot.colour) details.colour = String(flip.mot.colour);
  }

  // Only keep what this category actually asks about. A colour carried over
  // from an MOT lookup is no use on a category with no colour question.
  const asked = new Set(fieldsFor(category).map((f) => f.key));
  for (const key of Object.keys(details)) {
    if (!asked.has(key)) delete details[key];
  }

  return {
    photos: (flip.images ?? []).filter(
      (uri): uri is string => typeof uri === "string" && uri.trim() !== ""
    ),
    title: flip.title ?? "",
    price: suggestedPrice(flip),
    description: flip.ai?.fullDescription ?? flip.ai?.description ?? "",
    category,
    details,
  };
}
