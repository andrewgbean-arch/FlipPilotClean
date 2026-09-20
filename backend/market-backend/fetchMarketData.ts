import axios from "axios";
import fetchAmazonMarket from "./amazonMarket";
import fetchEbayMarket, { EbayMarketResult } from "./ebayMarket";
import fetchEbayBrowseMarket from "./ebayBrowseApi";
import { extractPackCount, isNotTheItem, matchesQuery, priceForPack } from "./bulkListingFilter";
import { decidePrices, type Grade } from "./priceModel";

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
  retailPrice: number | null;      // Amazon/Google = realistic new price

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
  amazon: {
    newPrice: number | null;
    usedPrice: number | null;
    image: string | null;
  } | null;

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

    const res = await axios.get(url, { timeout: 7000 });
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
  } = {}
): Promise<UnifiedMarketResult> {
  const wantedCount = options.packCount ?? extractPackCount(query);
  const condition = options.condition ?? null;
  const usedMode = condition === "used";
  const grade = options.grade ?? "good";
  const cacheKey = `${query.trim().toLowerCase()}|${wantedCount ?? ""}|${condition ?? ""}|${grade}`;
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
      amazon: null,
      ebayItems: [],
      googleItems: [],
      image: null,
    };
  }

  try {
    // 1️⃣-3️⃣ eBay, Amazon and Google are independent lookups — run them
    // concurrently instead of one after another (was costing 3x the latency
    // for no benefit, since none of these depend on each other's result).
    const startedAt = Date.now();

    const ebayPromise = withDeadline(
      hasEbayBrowseCreds()
        ? fetchEbayBrowseMarket(query, wantedCount, condition)
        : fetchEbayMarket(query, wantedCount),
      6500,
      null
    );
    // For a used item, what the same thing sells for NEW on eBay: with Google's
    // shelf price, that gives the new price a used price is worked out from.
    const ebayNewPromise =
      usedMode && hasEbayBrowseCreds()
        ? withDeadline(fetchEbayBrowseMarket(query, wantedCount, "new"), 6500, null)
        : Promise.resolve(null);
    // The AI's idea of the new price and the used range, asked alongside the
    // searches: the cross-check if what the searches found is far off.
    const aiEstimatePromise = withDeadline(fetchAiPriceEstimate(query, wantedCount), 5000, null);
    const amazonPromise = withDeadline(fetchAmazonMarket(query, wantedCount), 3000, null);
    const googlePromise = fetchGoogleShopping(query, wantedCount);

    const [ebay, amazon] = await Promise.all([ebayPromise, amazonPromise]);

    // Google Shopping is the slowest and least reliable of the three (anywhere
    // from a third of a second to twenty), so it does not hold the answer up:
    // once the others are in it gets a short grace period and is used only if
    // it made it. The AI's price estimate is the cross-check that doesn't wait.
    const googleGraceMs = Math.max(300, Math.min(1000, 4000 - (Date.now() - startedAt)));
    const google = await withDeadline(googlePromise, googleGraceMs, null);
    const aiEstimate = await aiEstimatePromise;
    const ebayNew = await ebayNewPromise;

    // 4️⃣ AI estimate (new price + used range)
    const aiPriceMin = safeNumber(aiEstimate?.min);
    const aiPriceMax = safeNumber(aiEstimate?.max);
    const aiPriceConfidence = safeNumber(aiEstimate?.confidence);

    // 5️⃣ The three prices: new, sell, buy (see priceModel.ts)
    const usedPrice = safeNumber(ebay?.average ?? ebay?.lowest ?? null);

    const decision = decidePrices({
      used: usedMode,
      grade,
      ebayNew: safeNumber(ebayNew?.average ?? null),
      ebay: usedPrice,
      amazonNew: safeNumber(amazon?.newPrice),
      googleNew: safeNumber(google?.avg),
      aiNew: safeNumber(aiEstimate?.newPrice),
      aiUsedMin: aiPriceMin,
      aiUsedMax: aiPriceMax,
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
  amazon?.image ??
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
      amazon: amazon
        ? {
            newPrice: amazon.newPrice ?? null,
            usedPrice: amazon.usedPrice ?? null,
            image: amazon.image ?? null,
          }
        : null,
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
      amazon: null,
      ebayItems: [],
      googleItems: [],
      image: null,
    };
  }
}
