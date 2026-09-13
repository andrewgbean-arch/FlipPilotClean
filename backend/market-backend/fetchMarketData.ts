import axios from "axios";
import fetchAmazonMarket from "./amazonMarket";
import fetchEbayMarket, { EbayMarketResult } from "./ebayMarket";


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
async function fetchGoogleShopping(query: string) {
  try {
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(
      query
    )}&api_key=${process.env.SERPAPI_KEY}`;

    const res = await axios.get(url, { timeout: 12000 });
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

        const p = parseFloat(
          String(c).replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        if (!isNaN(p)) rawPrices.push(p);
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
        timeout: 12000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = res.data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(raw);
  } catch (err: any) {
    console.log("AI PRICE ERROR:", err?.message || err);
    return null;
  }
}

/* --------------------------------------------------
   ⭐ MAIN UNIFIED MARKET FUNCTION
-------------------------------------------------- */
export default async function fetchMarketData(
  query: string
): Promise<UnifiedMarketResult> {
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
    const [ebay, amazon, google] = await Promise.all([
      fetchEbayMarket(query),
      fetchAmazonMarket(query),
      fetchGoogleShopping(query),
    ]);

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

    const average =
      safeNumber(
        (() => {
          const values = [usedPrice, retailPrice, google?.avg]
            .filter((v) => typeof v === "number") as number[];

          if (!values.length) return null;
          return values.reduce((a, b) => a + b, 0) / values.length;
        })()
      ) ?? usedPrice ?? retailPrice ?? google?.avg ?? null;

    // Prefer averaged/blended prices over a single raw min/max — a generic
    // search (especially from an AI-guessed title) often returns unrelated
    // items alongside real matches, and the cheapest/priciest single result
    // can be a wildly wrong outlier (e.g. a £25 cable next to a £600
    // premium unit under the same "speaker" search).
    const smartPrice =
      safeNumber(
        (() => {
          if (usedPrice && retailPrice) {
            return Number(((usedPrice * 0.6) + (retailPrice * 0.4)).toFixed(2));
          }
          if (average && average > 0) {
            return Number((average * 0.85).toFixed(2));
          }
          if (usedPrice) return Number((usedPrice * 0.9).toFixed(2));
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

    return {
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
