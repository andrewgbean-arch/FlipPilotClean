import axios from "axios";
import type { EbayMarketResult } from "./ebayMarket";
import fetchEbayBrowseMarket from "./ebayBrowseApi";
import { extractPackCount, isNotTheItem, matchesQuery, priceForPack } from "./bulkListingFilter";
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

    for (const item of sameProduct.length >= 3 ? sameProduct : items) {
      // The shelf price of the listing. (`unit_price` is a price per 100g or per
      // litre, which is not what the item costs, so it is not used.)
      const c = item.extracted_price ?? item.price;
      if (!c) continue;
      if (isNotTheItem(item.title, query)) continue;

      const listed = parseFloat(String(c).replace(/[^0-9.,]/g, "").replace(",", "."));
      // Scaled to the scanned pack size where the listing says its own; dropped if bulk.
      const p = priceForPack(item.title, listed, wantedCount);
      if (p !== null) rawPrices.push(p);
    }

    const prices = filterOutliers(rawPrices);

    if (!prices.length) {
      return { min: null, max: null, avg: null, items };
    }

    // Multipacks that don't say so, and premium sellers, only ever push a price
    // UP, so the shelf price of the item is nearer the bottom of what is listed
    // than the middle: use the lower quartile.
    const sorted = [...prices].sort((a, b) => a - b);
    const lowerQuartile = sorted[Math.floor((sorted.length - 1) * 0.25)];

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: lowerQuartile,
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

If the title could match multiple different models or quality tiers, assume the
common/budget version, not a premium or flagship one.

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
const cache = new Map<string, { at: number; value: UnifiedMarketResult }>();

function cacheGet(key: string): UnifiedMarketResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: UnifiedMarketResult) {
  // Only remember answers that found something; a failed lookup should be retried.
  if (value.lowest == null && value.smartPrice == null) return;
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
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
  cache.clear();
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
 *   GOOGLE_SHOPPING=always       (default) search on every scan, as before
 *   GOOGLE_SHOPPING=when-needed  search only when eBay did not give enough to price the item from
 * Turn "when-needed" on once the cost log (GET /admin/costs) shows it is worth the small difference
 * in some prices: Google is one of the sources the shelf price is worked out from.
 */
const googleWhenNeeded = () => (process.env.GOOGLE_SHOPPING ?? "").trim().toLowerCase() === "when-needed";

/** eBay alone is enough when it found a good number of matching listings (and, for a used item, of new ones too). */
const STRONG_LISTINGS = 5;
function ebayIsStrong(ebay: EbayMarketResult | null, ebayNew: EbayMarketResult | null, usedMode: boolean) {
  const enough = (r: EbayMarketResult | null, n: number) => !!r && r.average != null && (r.items?.length ?? 0) >= n;
  return enough(ebay, STRONG_LISTINGS) && (!usedMode || enough(ebayNew, 3));
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
  const cacheKey = `${query.trim().toLowerCase()}|${wantedCount ?? ""}|${condition ?? ""}|${grade}|${age}`;
  const cached = query ? cacheGet(cacheKey) : null;
  if (cached) return cached;

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
      ebayNew = await ebayNewPromise;
      if (ebayIsStrong(ebay, ebayNew, usedMode)) {
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
    const googleGraceMs = googleStartedLate ? 3000 : Math.max(300, Math.min(1000, 4000 - (Date.now() - startedAt)));
    const google = googlePromise ? await withDeadline(googlePromise, googleGraceMs, null) : null;
    const googleSkipped = googlePromise === null;
    const aiEstimate = await aiEstimatePromise;
    ebayNew = await ebayNewPromise;

    // 4️⃣ AI estimate (new price + used range)
    const aiPriceMin = safeNumber(aiEstimate?.min);
    const aiPriceMax = safeNumber(aiEstimate?.max);
    const aiPriceConfidence = safeNumber(aiEstimate?.confidence);

    // 5️⃣ The three prices: new, sell, buy (see priceModel.ts)
    const usedPrice = safeNumber(ebay?.average ?? ebay?.lowest ?? null);

    const decision = decidePrices({
      used: usedMode,
      grade,
      age,
      // With Google skipped, a sealed/new item's own eBay listings are the shelf-price evidence: they are
      // new listings, and their average is 90% of the middle asking price, so it is put back to that.
      ebayNew: safeNumber(ebayNew?.average ?? (googleSkipped && !usedMode && ebay?.average ? ebay.average / 0.9 : null)),
      ebay: usedPrice,
      googleNew: safeNumber(google?.avg),
      aiNew: safeNumber(aiEstimate?.newPrice),
      aiUsedMin: aiPriceMin,
      aiUsedMax: aiPriceMax,
      marketFloor: safeNumber(google?.min),
    });

    const retailPrice = decision.newPrice;
    const average = decision.sell;
    const smartPrice = decision.buy;

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

    const result: UnifiedMarketResult = {
      usedPrice,
      retailPrice,
      googlePriceMin,
      googlePriceMax,
      lowest,
      highest,
      average,
      smartPrice,
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
    };

    cacheSet(cacheKey, result);
    return result;
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
