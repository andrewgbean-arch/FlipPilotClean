import axios from "axios";
import fetchAmazonMarket from "./amazonMarket";
import fetchEbayMarket, { EbayMarketResult } from "./ebayMarket";
import fetchEbayBrowseMarket from "./ebayBrowseApi";
import { extractPackCount, priceForPack } from "./bulkListingFilter";

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
    // Without a region/currency pin, SerpAPI defaults to google.com (US) —
    // returning US listings priced in USD, which this app was silently
    // treating as GBP (a $3,699 US bike was being shown as £3,699+markup).
    // Force UK Google Shopping so results are in the right country AND
    // currency.
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(
      query
    )}&google_domain=google.co.uk&gl=uk&hl=en&currency=GBP&api_key=${process.env.SERPAPI_KEY}`;

    const res = await axios.get(url, { timeout: 4500 });
    const items = res.data.shopping_results ?? [];

    const rawPrices: number[] = [];

    for (const item of items) {
      const candidates = [
        item.extracted_price,
        item.unit_price,
        item.inline_offer?.price,
        item.price,
      ];

      for (const c of candidates) {
        if (!c) continue;

        const listed = parseFloat(
          String(c).replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        // Scaled to the scanned pack size where the listing says its own; dropped if bulk.
        const p = priceForPack(item.title, listed, wantedCount);
        if (p !== null) rawPrices.push(p);
      }
    }

    const prices = filterOutliers(rawPrices);

    if (!prices.length) {
      return { min: null, max: null, avg: null, items };
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      items,
    };
  } catch (err: any) {
    console.log("GOOGLE ERROR:", err?.message || err);
    return null;
  }
}

/* --------------------------------------------------
   ⭐ AI Price Fallback
-------------------------------------------------- */
async function fetchAiPriceEstimate(title: string) {
  if (!process.env.OPENAI_API_KEY || !title) return null;

  // This only runs when real eBay/Google comparables couldn't be found, so
  // there is nothing to sanity-check it against — ask specifically for
  // realistic USED/resale value (not brand-new RRP) and to assume the
  // common/budget version of the item rather than a premium tier, since
  // this number ends up driving the buy/sell recommendation directly.
  const prompt = `
Estimate the realistic UK SECOND-HAND resale price range for this exact
item — what it would typically actually sell for used on eBay or Facebook
Marketplace, NOT the brand-new retail price.

Item: "${title}"

If the title could match multiple different models or quality tiers,
assume the common/budget version, not a premium or flagship one.

Return ONLY valid JSON:
{
  "min": number,
  "max": number,
  "confidence": number
}
  `.trim();

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
      {
        timeout: 6000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // gpt-4o-mini often wraps its JSON in ```json fences despite being
    // asked for raw JSON — strip them before parsing (this was silently
    // failing every call where the model added them, logged as
    // "Unexpected token '`'", which meant this whole fallback was quietly
    // returning null more often than it should have).
    const raw = (res.data.choices?.[0]?.message?.content ?? "{}")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(raw);
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
  options: { packCount?: number | null } = {}
): Promise<UnifiedMarketResult> {
  const wantedCount = options.packCount ?? extractPackCount(query);
  const cacheKey = `${query.trim().toLowerCase()}|${wantedCount ?? ""}`;
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
        ? fetchEbayBrowseMarket(query, wantedCount)
        : fetchEbayMarket(query, wantedCount),
      6500,
      null
    );
    const amazonPromise = withDeadline(fetchAmazonMarket(query, wantedCount), 4500, null);
    const googlePromise = fetchGoogleShopping(query, wantedCount);

    const [ebay, amazon] = await Promise.all([ebayPromise, amazonPromise]);

    // Google Shopping is the slowest and least reliable of the three, so once
    // the others are in it only gets a short grace period rather than holding
    // the whole answer up for its full timeout.
    const googleGraceMs = Math.max(300, Math.min(1500, 5000 - (Date.now() - startedAt)));
    const google = await withDeadline(googlePromise, googleGraceMs, null);

    // 4️⃣ AI fallback (only if Google + eBay are weak)
    const weakGoogle = !google?.min || google.min < 1;
    const weakEbay = !ebay?.lowest || ebay.lowest < 1;

    let aiPriceMin: number | null = null;
    let aiPriceMax: number | null = null;
    let aiPriceConfidence: number | null = null;

    if (weakGoogle && weakEbay) {
      const aiPrice = await fetchAiPriceEstimate(query);
      if (aiPrice) {
        aiPriceMin = safeNumber(aiPrice.min);
        aiPriceMax = safeNumber(aiPrice.max);
        aiPriceConfidence = safeNumber(aiPrice.confidence);
      }
    }

    // 5️⃣ Core prices
    const usedPrice = safeNumber(
      ebay?.average ?? ebay?.lowest ?? null
    );

    // Use Google's blended average, not its single highest listing — the
    // max is often an unrelated premium outlier (a flagship/bundle listing
    // pulled in by a loose title match) and was dragging buy/sell prices
    // way above what the actual scanned item is worth.
    // AI fallback only kicks in when nothing real was found, so use the
    // midpoint of its range rather than the top of it — using aiPriceMax
    // here meant a wide/uncertain AI guess always resolved to its most
    // expensive end, not a representative value.
    const aiPriceMid =
      aiPriceMin != null && aiPriceMax != null
        ? (aiPriceMin + aiPriceMax) / 2
        : aiPriceMax;

    const retailPrice = safeNumber(
      amazon?.newPrice ??
      google?.avg ??
      ebay?.highest ??
      aiPriceMid ??
      null
    );

    // 6️⃣ Range + stats
    const googlePriceMin = safeNumber(
      google?.min ?? aiPriceMin ?? usedPrice ?? null
    );
    const googlePriceMax = safeNumber(
      google?.max ?? aiPriceMax ?? retailPrice ?? null
    );

    const lowest = safeNumber(
      ebay?.lowest ?? googlePriceMin ?? aiPriceMin ?? null
    );
    const highest = safeNumber(
      ebay?.highest ?? googlePriceMax ?? aiPriceMax ?? null
    );

    // eBay's `usedPrice` comes from SOLD listings — real recent transactions
    // for this exact query. Google/Amazon's `retailPrice` comes from *new*
    // listings/shopping ads, which skew toward premium/branded sellers who
    // pay to advertise — for a generic or unbranded item this runs well
    // above what it will actually resell for. Trust eBay's sold data as the
    // primary signal whenever we have it, rather than blending it evenly
    // with (or, as before, effectively double-counting) the ad-biased
    // retail number.
    //
    // NOTE: `retailPrice` already falls back through to `google?.avg` above,
    // so folding `google?.avg` into this blend again as a separate term
    // would silently double-weight it — that was a real bug (Google's
    // number counted twice vs eBay's once), which is exactly the kind of
    // thing that pushes a blended "average" price toward the pricier,
    // ad-driven source.
    const average = safeNumber(
      usedPrice
        ? retailPrice
          ? usedPrice * 0.7 + retailPrice * 0.3
          : usedPrice * 1.15
        : retailPrice ?? null
    );

    // Prefer averaged/blended prices over a single raw min/max — a generic
    // search (especially from an AI-guessed title) often returns unrelated
    // items alongside real matches, and the cheapest/priciest single result
    // can be a wildly wrong outlier (e.g. a £25 cable next to a £600
    // premium unit under the same "speaker" search).
    const smartPrice =
      safeNumber(
        (() => {
          if (usedPrice && retailPrice) {
            return Number(((usedPrice * 0.75) + (retailPrice * 0.25)).toFixed(2));
          }
          if (usedPrice) return Number((usedPrice * 0.85).toFixed(2));
          if (average && average > 0) {
            return Number((average * 0.85).toFixed(2));
          }
          if (retailPrice) return Number((retailPrice * 0.7).toFixed(2));
          if (googlePriceMin && googlePriceMin > 0) {
            return Number((googlePriceMin * 0.9).toFixed(2));
          }
          return aiPriceMin ?? aiPriceMax ?? null;
        })()
      ) ?? null;

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
