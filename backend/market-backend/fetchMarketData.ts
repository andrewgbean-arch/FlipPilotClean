import axios from "axios";
import type { EbayMarketResult } from "./ebayMarket";
import fetchEbayBrowseMarket from "./ebayBrowseApi";
import { extractPackCount, extractVolume, isCapacityRatedGoods, isNotTheItem, matchesQuery, priceForPack } from "./bulkListingFilter";
import { decidePrices, type AgeBand, type Grade } from "./priceModel";
import { SourceCache } from "../utils/sourceCache";
import { openAiUsage, recordCost } from "../utils/costLog";

// Read this at call time, not at module load — server.ts imports this
// module (via search.ts/searchImage.ts) BEFORE it calls dotenv.config(),
// so a module-level `const` here would freeze as false forever even once
// the env vars are actually set (confirmed live: the function worked
// perfectly called directly, but returned nothing through the real
// server until this was made lazy).
function hasEbayBrowseCreds() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}


export interface UnifiedMarketResult {
  // Core prices
  usedPrice: number | null;        // eBay sold = realistic used price
  retailPrice: number | null;      // Google/eBay-new = realistic new price

  // Google-style range
  googlePriceMin: number | null;
  googlePriceMax: number | null;

  // Aggregated stats
  lowest: number | null;
  highest: number | null;
  average: number | null;
  smartPrice: number | null;

  // Demand / confidence
  soldCount: number;
  demandScore: number;
  sellThroughRating: number | null;
  confidence: number;

  // AI price fallback
  aiPriceMin: number | null;
  aiPriceMax: number | null;
  aiPriceConfidence: number | null;

  // Raw sources
  ebay: EbayMarketResult | null;

  // Items (for UI)
  ebayItems: any[];
  googleItems: any[];
  image: string | null;
}

/* --------------------------------------------------
   ⭐ OUTLIER FILTER
-------------------------------------------------- */
function filterOutliers(prices: number[]) {
  if (prices.length < 4) return prices;

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  const min = q1 - iqr * 1.5;
  const max = q3 + iqr * 1.5;

  return prices.filter((p) => p >= min && p <= max);
}

/**
 * The single "shelf price" figure to represent a set of already-filtered, genuinely comparable
 * listings — the upper quartile, not the middle or the bottom. Used to lean on the lower quartile,
 * on the reasoning that an unlabelled multipack or a premium seller only ever pushes a price UP.
 * That's now handled properly, per listing, before a price ever reaches here (priceForPack/
 * isBulkListing in bulkListingFilter.ts) — so what's left is real variation between genuine
 * single-unit listings, and erring low on that side quietly undersold a lot of what got scanned
 * today (a De'Longhi Rivelia's own real £449-808 UK listings, correctly matched, still landed low
 * as "the" price). Lean dearer instead.
 */
export function dearerQuartile(prices: number[]): number | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length - 1) * 0.75)];
}

/* --------------------------------------------------
   ⭐ Helper: merge prices safely
-------------------------------------------------- */
function safeNumber(n: unknown): number | null {
  if (typeof n === "number" && !isNaN(n)) return n;
  return null;
}

/* --------------------------------------------------
   ⭐ Google Shopping (copied from /search, wrapped)
-------------------------------------------------- */
async function fetchGoogleShopping(query: string, wantedCount?: number | null) {
  try {
    // Without a region pin, SerpAPI defaults to google.com (US) — returning US
    // listings priced in USD, which this app was silently treating as GBP.
    // The UK is `gl=gb`. This used to say `gl=uk`, which is not a valid country
    // code: Google answered "no results" for almost every search, so this whole
    // source was quietly doing nothing (with gb, "Monster Munch 72g" returns
    // £1.25 and £1.50, the real shelf prices).
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(
      query
    )}&google_domain=google.co.uk&gl=gb&hl=en&api_key=${process.env.SERPAPI_KEY}`;

    let res;
    let answered = false;
    try {
      res = await axios.get(url, { timeout: 7000 });
      answered = true;
    } finally {
      // A search that timed out may still be charged, so it is counted as a call either way.
      recordCost("serpapi", "google-shopping", { failed: !answered });
    }
    const items = res.data.shopping_results ?? [];

    const rawPrices: number[] = [];

    // Google Shopping mixes in other models and other flavours. Use the ones for
    // this product, unless there are too few of those.
    const sameProduct = items.filter((i: any) => matchesQuery(i?.title, query));

    // Same reasoning as the eBay side (ebayBrowseApi.ts): a listing that genuinely matches the
    // scanned item's own stated size isn't bulk, and a tumble dryer/fridge/etc never states its
    // own capacity in a photo, so the oversized-volume rule is skipped for it outright.
    const ownVolume = extractVolume(query);
    const capacityRatedGoods = isCapacityRatedGoods(query);

    for (const item of sameProduct.length >= 3 ? sameProduct : items) {
      // The shelf price of the listing. (`unit_price` is a price per 100g or per
      // litre, which is not what the item costs, so it is not used.)
      const c = item.extracted_price ?? item.price;
      if (!c) continue;
      if (isNotTheItem(item.title, query, capacityRatedGoods)) continue;

      const listed = parseFloat(String(c).replace(/[^0-9.,]/g, "").replace(",", "."));
      // Scaled to the scanned pack size where the listing says its own; dropped if bulk.
      const p = priceForPack(item.title, listed, wantedCount, ownVolume, capacityRatedGoods);
      if (p !== null) rawPrices.push(p);
    }

    const prices = filterOutliers(rawPrices);

    if (!prices.length) {
      return { min: null, max: null, avg: null, items };
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: dearerQuartile(prices),
      items,
    };
  } catch (err: any) {
    console.log("GOOGLE ERROR:", err?.message || err);
    return null;
  }
}

/* --------------------------------------------------
   ⭐ AI price estimate

   Asked every time, alongside the searches: what one new unit costs in a UK
   shop, and what it is worth second-hand. Search results for cheap things are
   full of multipacks and for models are full of neighbouring models, and this
   is the cross-check that keeps a wildly wrong search from becoming the price.
-------------------------------------------------- */
async function fetchAiPriceEstimate(title: string, packCount?: number | null) {
  if (!process.env.OPENAI_API_KEY || !title) return null;

  const prompt = `
You are pricing an item for a UK reseller.

Item: "${title}"${packCount ? `\nPack size: ${packCount} in the pack` : ""}

If the title is generic and could genuinely mean several different models or quality tiers
(nothing in it points to one specific product), assume the common/budget version rather than
a premium or flagship one. But if the title names an ACTUAL specific model (a model name,
number or product line — even one you don't have detailed pricing knowledge of, such as a
newer or less common release), price that real model as accurately as you can from what you
do know of the brand and line it belongs to. Never substitute a cheaper, better-known model
from the same brand just because you are less sure about this exact one — say what you
genuinely think this specific thing costs, and lower "confidence" instead of lowering the price.

Return ONLY valid JSON (prices in pounds sterling):
{
  "newPrice": typical price of ONE brand-new unit${packCount ? " (this pack size)" : ""} in a UK shop today,
  "usedMin": low end of what it realistically sells for second-hand on eBay or Facebook Marketplace,
  "usedMax": high end of the same range,
  "confidence": 0-100 how sure you are
}
  `.trim();

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 120,
      },
      {
        timeout: 6000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    recordCost("openai", "price-estimate", openAiUsage(res.data));

    // gpt-4o-mini often wraps its JSON in ```json fences despite being asked
    // for raw JSON — strip them before parsing.
    const raw = (res.data.choices?.[0]?.message?.content ?? "{}")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(raw);
    return {
      newPrice: safeNumber(Number(parsed.newPrice)),
      min: safeNumber(Number(parsed.usedMin)),
      max: safeNumber(Number(parsed.usedMax)),
      confidence: safeNumber(Number(parsed.confidence)),
    };
  } catch (err: any) {
    console.log("AI PRICE ERROR:", err?.message || err);
    recordCost("openai", "price-estimate", { failed: true });
    return null;
  }
}

/* --------------------------------------------------
   ⭐ Speed: hard deadline per source + short-lived cache
-------------------------------------------------- */
// A slow source used to hold the whole answer up. Each one now gets a deadline
// and, if it misses it, counts as "no data" so the others can be used.
function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

// Scanning the same item twice (or a second person scanning it) should not pay
// for the same lookups again.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

// Everything about an item EXCEPT its sell/buy price (which depends on Condition and Age — see
// priceModel.ts) is the same whoever is asking and whatever they choose on those two boxes. Cached
// under a key with no Condition or Age in it, so changing either box, or two different people
// scanning the same thing, reuses exactly the same real-world evidence — not a second live lookup
// that, being a live marketplace, could genuinely come back with a different answer by chance. Sell
// and buy are worked out fresh every time from `priceInputs`, which costs nothing (no lookup).
export type MarketEvidence = Omit<UnifiedMarketResult, "average" | "smartPrice"> & {
  priceInputs: {
    ebayNew: number | null;
    ebay: number | null;
    googleNew: number | null;
    aiNew: number | null;
    aiUsedMin: number | null;
    aiUsedMax: number | null;
    marketFloor: number | null;
  };
};

const evidenceCache = new Map<string, { at: number; value: MarketEvidence }>();

export function evidenceCacheGet(key: string): MarketEvidence | null {
  const hit = evidenceCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    evidenceCache.delete(key);
    return null;
  }
  return hit.value;
}

export function evidenceCacheSet(key: string, value: MarketEvidence, googleStillMissing: boolean) {
  // Only remember answers that found something; a failed lookup should be retried.
  if (value.lowest == null && value.priceInputs.ebay == null && value.priceInputs.googleNew == null && value.priceInputs.aiNew == null) return;
  // ebayIsStrong specifically decided Google was needed (eBay's own numbers weren't good enough
  // alone) and it still came back empty even after its own grace period — caching that half-answer
  // for the full 10 minutes would serve the same wrong price to every identical scan in that
  // window, when a retry moments later is likely to succeed (found live: exactly this, on a
  // Vitamix A3500). Not caching it at all means the next identical scan tries Google again fresh.
  if (googleStillMissing) return;
  if (evidenceCache.size >= CACHE_MAX) {
    const oldest = evidenceCache.keys().next().value;
    if (oldest !== undefined) evidenceCache.delete(oldest);
  }
  evidenceCache.set(key, { at: Date.now(), value });
}

/** Sell and buy for the CURRENT grade/age, from evidence that may have been fetched for a different one. */
export function priceEvidence(evidence: MarketEvidence, usedMode: boolean, grade: Grade, age: AgeBand): UnifiedMarketResult {
  const decision = decidePrices({ used: usedMode, grade, age, ...evidence.priceInputs });
  return { ...evidence, average: decision.sell, smartPrice: decision.buy };
}

/* --------------------------------------------------
   ⭐ Paying for each source once

   Each paid source is remembered on its own, not just the finished answer, so the same question is not
   bought twice: another person scanning the same thing, or the same person changing the Condition or
   Age box on a result (which asks for the price again), reuses what was already paid for.

   Google and the AI estimate are kept for a day (a shop price or an AI opinion of a price does not
   change by the hour). eBay's answers are kept only 10 minutes: eBay's licence limits how long its
   content may be stored.
-------------------------------------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const googleCache = new SourceCache<Awaited<ReturnType<typeof fetchGoogleShopping>>>(DAY_MS, 1000, (r) => !!r && r.avg != null);
const aiEstimateCache = new SourceCache<Awaited<ReturnType<typeof fetchAiPriceEstimate>>>(DAY_MS, 1000, (r) => !!r && r.newPrice != null);
const ebayCache = new SourceCache<EbayMarketResult>(10 * 60 * 1000, 300, (r) => (r?.items?.length ?? 0) > 0);

const sourceKey = (query: string, count: number | null | undefined, extra = "") =>
  `${query.trim().toLowerCase()}|${count ?? ""}|${extra}`;

export function clearMarketCachesForTests() {
  evidenceCache.clear();
  googleCache.clear();
  aiEstimateCache.clear();
  ebayCache.clear();
}
export const marketCacheStats = () => ({
  google: { hits: googleCache.hits, misses: googleCache.misses },
  aiEstimate: { hits: aiEstimateCache.hits, misses: aiEstimateCache.misses },
  ebay: { hits: ebayCache.hits, misses: ebayCache.misses },
});

/**
 * Google Shopping is the dearest source (a paid search on every scan).
 *   GOOGLE_SHOPPING=when-needed  (default) search only when eBay did not give enough to price the item from
 *   GOOGLE_SHOPPING=always       search on every scan, as before 2026-09-27
 * "when-needed" is the default since the owner chose it on 2026-09-27 (Trader plan pricing): the
 * Google search is most of what a scan costs (about 1.1-1.9p of ~2.2p), and when eBay already has
 * plenty of matching listings it adds little. Set "always" to go back; GET /admin/costs shows the effect.
 */
const googleWhenNeeded = () => (process.env.GOOGLE_SHOPPING ?? "").trim().toLowerCase() !== "always";

/**
 * eBay alone is enough when it found a good number of matching listings (and, for a used item, of
 * new ones too) that both:
 *   (a) broadly AGREE WITH EACH OTHER — a handful of listings technically clearing the headcount
 *       but scattered across a wide price range says the market is too thin or too mismatched to
 *       trust on its own, however many of them there are;
 *   (b) aren't being flatly CONTRADICTED BY THE AI's own guess — eBay's own listings can be tight
 *       among themselves and still be quietly wrong (found live: a De'Longhi Rivelia where eBay's
 *       "new condition" listings agreed with each other at ~£535, itself already well under its
 *       real ~£650 UK retail price, while the AI's own guess was £150 — a 3.5x gap between two
 *       independent opinions that Google's real retailer prices exist specifically to settle);
 *   (c) aren't for a genuinely EXPENSIVE item — the same percentage error means a lot more real
 *       money on a £600 espresso machine than a £15 phone case, so above HIGH_VALUE_THRESHOLD
 *       Google is always worth the extra penny or two, whatever eBay's own numbers look like.
 * Any signal alone can miss a genuinely unreliable read; checking all three catches more of them
 * without paying for Google on the many ordinary, cheap scans where eBay is simply, verifiably right.
 */
const STRONG_LISTINGS = 5;
const MAX_STRONG_SPREAD = 3;
const MAX_AGREEMENT_GAP = 2;
const HIGH_VALUE_THRESHOLD = 200;
export function ebayIsStrong(ebay: EbayMarketResult | null, ebayNew: EbayMarketResult | null, usedMode: boolean, aiNew: number | null) {
  const consistent = (r: EbayMarketResult | null, n: number) =>
    !!r &&
    r.average != null &&
    (r.items?.length ?? 0) >= n &&
    r.lowest != null &&
    r.highest != null &&
    r.lowest > 0 &&
    r.highest / r.lowest <= MAX_STRONG_SPREAD;

  // The source that stands in for "what this costs new" — eBay's own new-condition search for a
  // used item, or the main search itself for something sealed.
  const primary = usedMode ? ebayNew : ebay;
  const agreesWithAi =
    !(typeof aiNew === "number" && aiNew > 0) ||
    !primary?.average ||
    Math.max(aiNew, primary.average) / Math.min(aiNew, primary.average) <= MAX_AGREEMENT_GAP;
  const notHighValue = !primary?.average || primary.average <= HIGH_VALUE_THRESHOLD;

  return consistent(ebay, STRONG_LISTINGS) && (!usedMode || consistent(ebayNew, 3)) && agreesWithAi && notHighValue;
}

/* --------------------------------------------------
   ⭐ MAIN UNIFIED MARKET FUNCTION

   `options.packCount` is how many units the scanned item holds (read off the
   label or the barcode record). When it is not given, it is read from the
   query text ("... 20 lozenges").
-------------------------------------------------- */
export default async function fetchMarketData(
  query: string,
  options: {
    packCount?: number | null;
    condition?: "new" | "used" | null;
    grade?: Grade | null;
    age?: AgeBand | null;
  } = {}
): Promise<UnifiedMarketResult> {
  const wantedCount = options.packCount ?? extractPackCount(query);
  const condition = options.condition ?? null;
  const usedMode = condition === "used";
  const grade = options.grade ?? "good";
  const age = options.age ?? "within-6-months";
  // No Condition or Age in this key — see MarketEvidence above.
  const evidenceCacheKey = `${query.trim().toLowerCase()}|${wantedCount ?? ""}|${condition ?? ""}`;
  const cachedEvidence = query ? evidenceCacheGet(evidenceCacheKey) : null;
  if (cachedEvidence) return priceEvidence(cachedEvidence, usedMode, grade, age);

  if (!query) {
    return {
      usedPrice: null,
      retailPrice: null,
      googlePriceMin: null,
      googlePriceMax: null,
      lowest: null,
      highest: null,
      average: null,
      smartPrice: null,
      soldCount: 0,
      demandScore: 0,
      sellThroughRating: null,
      confidence: 0,
      aiPriceMin: null,
      aiPriceMax: null,
      aiPriceConfidence: null,
      ebay: null,
      ebayItems: [],
      googleItems: [],
      image: null,
    };
  }

  try {
    // eBay and Google are independent lookups — run them concurrently instead
    // of one after another, since neither depends on the other's result.
    const startedAt = Date.now();

    // eBay data comes only from eBay's own Browse API. With no keys set there is
    // simply no eBay data: the old fallback scraped eBay search pages, which
    // eBay's API License Agreement does not allow.
    const ebayPromise = withDeadline(
      hasEbayBrowseCreds()
        ? ebayCache.get(sourceKey(query, wantedCount, condition ?? ""), () => fetchEbayBrowseMarket(query, wantedCount, condition))
        : Promise.resolve(null),
      6500,
      null
    );
    // For a used item, what the same thing sells for NEW on eBay: with Google's
    // shelf price, that gives the new price a used price is worked out from.
    const ebayNewPromise =
      usedMode && hasEbayBrowseCreds()
        ? withDeadline(ebayCache.get(sourceKey(query, wantedCount, "new"), () => fetchEbayBrowseMarket(query, wantedCount, "new")), 6500, null)
        : Promise.resolve(null);
    // The AI's idea of the new price and the used range, asked alongside the
    // searches: the cross-check if what the searches found is far off.
    const aiEstimatePromise = withDeadline(
      aiEstimateCache.get(sourceKey(query, wantedCount), () => fetchAiPriceEstimate(query, wantedCount)),
      5000,
      null
    );
    const searchGoogle = () => googleCache.get(sourceKey(query, wantedCount), () => fetchGoogleShopping(query, wantedCount));

    // Normally Google is asked at the same time as the others. In "when-needed" mode it waits to see
    // whether eBay gives enough on its own, and is only paid for if not.
    let googlePromise: ReturnType<typeof searchGoogle> | null = googleWhenNeeded() ? null : searchGoogle();

    const ebay = await ebayPromise;
    let ebayNew: Awaited<typeof ebayNewPromise> = null;
    let googleStartedLate = false;
    if (!googlePromise) {
      // Already running since aiEstimatePromise started alongside ebayPromise above — awaiting it
      // here to judge eBay's strength costs no extra time, and it's awaited again (instantly, from
      // the same settled promise) further down where its full value feeds the final price.
      const [resolvedEbayNew, aiEstimate] = await Promise.all([ebayNewPromise, aiEstimatePromise]);
      ebayNew = resolvedEbayNew;
      if (ebayIsStrong(ebay, ebayNew, usedMode, safeNumber(aiEstimate?.newPrice))) {
        console.log(`market: Google skipped for "${query.slice(0, 40)}" (eBay had ${ebay?.items?.length} listings)`);
      } else {
        googlePromise = searchGoogle();
        googleStartedLate = true;
      }
    }

    // Google Shopping is the slowest and least reliable source (anywhere
    // from a third of a second to twenty), so it does not hold the answer up:
    // once the others are in it gets a short grace period and is used only if
    // it made it. The AI's price estimate is the cross-check that doesn't wait.
    // A late start means ebayIsStrong specifically decided Google was NEEDED (found live: a
    // Vitamix A3500 that genuinely needed it kept coming back without Google's price at all,
    // even though a fresh retry moments later found real results in well under 8s) — worth a
    // real grace period, not the 3s a merely-optional check got, given the whole reason this
    // path exists at all is that the answer is otherwise judged unreliable.
    const googleGraceMs = googleStartedLate ? 8000 : Math.max(300, Math.min(1000, 4000 - (Date.now() - startedAt)));
    const google = googlePromise ? await withDeadline(googlePromise, googleGraceMs, null) : null;
    const googleSkipped = googlePromise === null;
    const aiEstimate = await aiEstimatePromise;
    ebayNew = await ebayNewPromise;

    // 4️⃣ AI estimate (new price + used range)
    const aiPriceMin = safeNumber(aiEstimate?.min);
    const aiPriceMax = safeNumber(aiEstimate?.max);
    const aiPriceConfidence = safeNumber(aiEstimate?.confidence);

    // 5️⃣ The three prices: new, sell, buy (see priceModel.ts). These scalar inputs are the only
    // things that can change between one Condition/Age choice and another for the SAME item — kept
    // as their own object so a later request for a different Condition or Age can redo just this
    // step, with no fresh lookup, from evidence that never varies with what was picked.
    const usedPrice = safeNumber(ebay?.average ?? ebay?.lowest ?? null);
    const priceInputs = {
      // With Google skipped, a sealed/new item's own eBay listings are the shelf-price evidence: they are
      // new listings, and their average is 90% of the middle asking price, so it is put back to that.
      ebayNew: safeNumber(ebayNew?.average ?? (googleSkipped && !usedMode && ebay?.average ? ebay.average / 0.9 : null)),
      ebay: usedPrice,
      googleNew: safeNumber(google?.avg),
      aiNew: safeNumber(aiEstimate?.newPrice),
      aiUsedMin: aiPriceMin,
      aiUsedMax: aiPriceMax,
      marketFloor: safeNumber(google?.min),
    };
    // Only newPrice is needed here (it never varies with grade/age — see priceModel.ts); this
    // request's own sell/buy are worked out below, from priceEvidence(), the same way a cache hit's
    // are, so there is exactly one place that turns evidence into a price.
    const retailPrice = decidePrices({ used: usedMode, grade, age, ...priceInputs }).newPrice;

    // 6️⃣ Range + stats
    const googlePriceMin = safeNumber(google?.min ?? aiPriceMin ?? usedPrice ?? null);
    const googlePriceMax = safeNumber(google?.max ?? aiPriceMax ?? retailPrice ?? null);

    const lowest = safeNumber(ebay?.lowest ?? googlePriceMin ?? aiPriceMin ?? null);
    const highest = safeNumber(ebay?.highest ?? googlePriceMax ?? aiPriceMax ?? null);

    // 7️⃣ Demand + confidence
    const soldCount = ebay?.soldCount ?? ebay?.items?.length ?? 0;
    const demandScore = ebay?.demandScore ?? Math.min(100, soldCount * 5);
    const sellThroughRating = ebay?.sellThroughRating ?? null;

    const confidence = (() => {
      let score = 0;
      if (usedPrice) score += 25;
      if (retailPrice) score += 25;
      if (googlePriceMin && googlePriceMax) score += 20;
      if (soldCount > 0) score += 15;
      if (demandScore > 0) score += 15;
      return Math.min(100, score);
    })();

    // 8️⃣ Image + items
const image =
  ebay?.items?.[0]?.thumbnail ??
  google?.items?.[0]?.thumbnail ??
  null;





    const ebayItems = ebay?.ebayData?.items ?? ebay?.items ?? [];
    const googleItems = google?.items ?? [];

    const evidence: MarketEvidence = {
      usedPrice,
      retailPrice,
      googlePriceMin,
      googlePriceMax,
      lowest,
      highest,
      soldCount,
      demandScore,
      sellThroughRating,
      confidence,
      aiPriceMin,
      aiPriceMax,
      aiPriceConfidence,
      ebay,
      ebayItems,
      googleItems,
      image,
      priceInputs,
    };

    evidenceCacheSet(evidenceCacheKey, evidence, googleStartedLate && (!google || google.avg == null));
    return priceEvidence(evidence, usedMode, grade, age);
  } catch (err: any) {
    console.error("Unified Market Engine Error:", err?.message || err);

    return {
      usedPrice: null,
      retailPrice: null,
      googlePriceMin: null,
      googlePriceMax: null,
      lowest: null,
      highest: null,
      average: null,
      smartPrice: null,
      soldCount: 0,
      demandScore: 0,
      sellThroughRating: null,
      confidence: 0,
      aiPriceMin: null,
      aiPriceMax: null,
      aiPriceConfidence: null,
      ebay: null,
      ebayItems: [],
      googleItems: [],
      image: null,
    };
  }
}
