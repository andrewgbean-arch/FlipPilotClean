import axios from "axios";
import { getEbayAccessToken } from "../market-backend/ebayBrowseApi";
import { matchesQuery } from "../market-backend/bulkListingFilter";

/* --------------------------------------------------
   ⭐ A real vehicle price estimate

   Replaces the deleted fake "AI advisor" (a hardcoded multiplier formula
   with a user-typed "confidence" number redisplayed as if AI produced it -
   see the strip-out commit). This asks eBay's real Cars category (GB
   category id 9801 - confirmed live: searching without it mixes in car
   PARTS listings, like Ford bumpers and speakers, under the same brand
   name) for genuinely comparable cars, then adjusts for the specific
   car's mileage and condition, cross-checked against an AI estimate the
   same way the item-pricing model does. Every number here is a rule of
   thumb, not a measurement - the real listings are returned alongside
   the estimate so the answer is inspectable, not a black box.
-------------------------------------------------- */

const CARS_CATEGORY_ID = "9801"; // eBay GB: Cars, Motorcycles & Vehicles > Cars

// Listings for a written-off, non-runner or partable car are not comparable
// to a normal roadworthy one - the same "not the item" problem as spare
// parts polluting a regular item's price, just car-shaped.
const NOT_COMPARABLE = /spares?\s*(or|\/)\s*repair|non.?runner|salvage|write.?off|cat(?:egory)?\s*[a-d]\b|export\s*only|no\s*mot|non.?mot|breaking|for\s*parts/i;

export type VehicleCondition = "excellent" | "good" | "fair" | "poor";

export interface VehiclePriceInput {
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  condition: VehicleCondition;
  motAdvisoryCount: number;
  motFailureCount: number;
}

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

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function filterOutliers(prices: number[]) {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return prices.filter((p) => p >= q1 - iqr * 1.5 && p <= q3 + iqr * 1.5);
}

async function searchComparableCars(make: string, model: string, year: number) {
  const token = await getEbayAccessToken();
  const query = `${year} ${make} ${model}`;

  const res = await axios.get("https://api.ebay.com/buy/browse/v1/item_summary/search", {
    timeout: 7000,
    params: { q: query, category_ids: CARS_CATEGORY_ID, limit: 50 },
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB" },
  });

  const summaries: any[] = res.data.itemSummaries ?? [];
  const matching = summaries.filter((i) => matchesQuery(i?.title, `${make} ${model}`));
  const pool = matching.length >= 3 ? matching : summaries;

  const comparables: { title: string; price: number; url: string | null }[] = [];
  for (const item of pool) {
    if (NOT_COMPARABLE.test(String(item?.title ?? ""))) continue;
    const price = Number(item?.price?.value);
    if (!Number.isFinite(price) || price <= 0) continue;
    comparables.push({
      title: String(item?.title ?? query),
      price,
      url: item?.itemWebUrl ?? null,
    });
  }

  return comparables;
}

/** The AI's cross-check: a rough sense-check against the eBay-derived figure, not the answer itself. */
async function fetchAiVehicleEstimate(input: VehiclePriceInput): Promise<number | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `
You are estimating the UK resale value of a used car for a reseller.

${input.year} ${input.make} ${input.model}
Mileage: ${input.mileage ?? "unknown"}
Condition: ${input.condition}
MOT advisories on record: ${input.motAdvisoryCount}
Outstanding MOT failures: ${input.motFailureCount}

Return ONLY valid JSON: { "estimatedValue": typical UK private-sale price in pounds for exactly this car as described }
  `.trim();

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 60,
      },
      {
        timeout: 6000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const raw = (res.data.choices?.[0]?.message?.content ?? "{}")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const value = Number(JSON.parse(raw).estimatedValue);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (err: any) {
    console.log("AI vehicle estimate failed:", err?.response?.data ?? err?.message);
    return null;
  }
}

// Rules of thumb, not measurements - each capped so no single factor can run away.
const CONDITION_ADJUSTMENT: Record<VehicleCondition, number> = {
  excellent: 1.12,
  good: 1.0,
  fair: 0.88,
  poor: 0.72,
};
const UK_AVERAGE_MILES_PER_YEAR = 8000;
const MAX_MILEAGE_ADJUSTMENT = 0.2; // ±20%, however far off the average mileage is
const MAX_MOT_PENALTY = 0.15; // outstanding failures/advisories, ±15%

export async function estimateVehiclePrice(input: VehiclePriceInput): Promise<VehiclePriceResult> {
  if (!input.make || !input.model || !input.year) {
    return { ok: false, error: "missing-fields", message: "Make, model and year are needed for a price estimate." };
  }

  let comparables: { title: string; price: number; url: string | null }[];
  try {
    comparables = await searchComparableCars(input.make, input.model, input.year);
  } catch (err: any) {
    console.log("eBay vehicle search failed:", err?.response?.data ?? err?.message);
    return {
      ok: false,
      error: "lookup-failed",
      message: "Couldn't reach eBay to find comparable cars right now. Please try again.",
    };
  }

  const prices = filterOutliers(comparables.map((c) => c.price));
  if (prices.length < 2) {
    return {
      ok: false,
      error: "not-enough-data",
      message: "Not enough comparable listings were found for this make, model and year to give a reliable estimate.",
    };
  }

  const baseline = median(prices);
  const notes: string[] = [];

  // Condition
  let estimate = baseline * CONDITION_ADJUSTMENT[input.condition];

  // Mileage: above-average mileage for the car's age pulls the price down,
  // below-average pulls it up - capped so an odometer typo can't wreck it.
  const ageYears = Math.max(0, new Date().getFullYear() - input.year);
  const expectedMileage = ageYears * UK_AVERAGE_MILES_PER_YEAR;
  if (input.mileage != null && expectedMileage > 0) {
    const deviation = (expectedMileage - input.mileage) / expectedMileage;
    const mileageAdjustment = Math.max(-MAX_MILEAGE_ADJUSTMENT, Math.min(MAX_MILEAGE_ADJUSTMENT, deviation * 0.5));
    estimate *= 1 + mileageAdjustment;
    if (Math.abs(mileageAdjustment) > 0.02) {
      notes.push(
        mileageAdjustment > 0
          ? "Lower mileage than average for its age, adjusted up."
          : "Higher mileage than average for its age, adjusted down."
      );
    }
  }

  // MOT record: outstanding failures matter far more than routine advisories.
  const motPenalty = Math.min(
    MAX_MOT_PENALTY,
    input.motFailureCount * 0.08 + input.motAdvisoryCount * 0.015
  );
  if (motPenalty > 0) {
    estimate *= 1 - motPenalty;
    notes.push(
      input.motFailureCount > 0
        ? "Outstanding MOT failures on record, adjusted down."
        : "MOT advisories on record, adjusted down slightly."
    );
  }

  // AI cross-check: unlike the item-pricing model, this does NOT get equal
  // weight against real market data. Proven live: for a 2014 Ford Fiesta
  // with 12 solid eBay comparables (median ~£2,550, matching the real
  // listings), gpt-4o-mini guessed ~£8,200 - a specific car's resale value
  // is exactly the kind of precise numeric fact an LLM is unreliable on.
  // With enough real comparables already, trust them; the AI only steps in
  // as a sanity net when there's too little real data to go on.
  let confidence: "low" | "medium" | "high" = prices.length >= 8 ? "high" : prices.length >= 4 ? "medium" : "low";
  if (prices.length < 4) {
    const aiEstimate = await fetchAiVehicleEstimate(input);
    if (aiEstimate != null) {
      const ratio = Math.max(estimate, aiEstimate) / Math.min(estimate, aiEstimate);
      if (ratio > 2) {
        // Wildly apart with too little real data either way - land between
        // them rather than trust either alone, and say so plainly.
        estimate = Math.sqrt(estimate * aiEstimate);
        notes.push("Very few comparable listings were found, and the AI's estimate disagreed a lot; this is a midpoint.");
      } else {
        estimate = (estimate + aiEstimate) / 2;
        notes.push("Few comparable listings were found; blended with an AI estimate.");
      }
    }
  }

  const finalValue = Math.round(estimate);
  const range = {
    min: Math.round(finalValue * 0.9),
    max: Math.round(finalValue * 1.1),
  };

  return {
    ok: true,
    estimatedValue: finalValue,
    range,
    baseline: Math.round(baseline),
    comparableCount: prices.length,
    comparables: comparables.slice(0, 10),
    confidence,
    notes,
  };
}
