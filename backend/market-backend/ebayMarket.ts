import axios from "axios";
import { priceForPack } from "./bulkListingFilter";

export interface EbayMarketResult {
  average: number | null;
  lowest: number | null;
  highest: number | null;

  smartPrice?: number | null;
  googlePriceMin?: number | null;
  googlePriceMax?: number | null;

  usedPrice?: number | null;
  retailPrice?: number | null;

  soldCount?: number | null;
  demandScore?: number | null;

  sellThroughRating?: number | null;

  ebayData?: {
    items: any[];
  };

  items?: any[];
  confidence?: number;
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
   ⭐ MAIN FUNCTION
-------------------------------------------------- */
export default async function fetchEbayMarket(
  query: string,
  wantedCount?: number | null
): Promise<EbayMarketResult> {
  try {
    if (!query) {
      return {
        average: null,
        lowest: null,
        highest: null,
        smartPrice: null,
        googlePriceMin: null,
        googlePriceMax: null,
        usedPrice: null,
        retailPrice: null,
        soldCount: null,
        demandScore: null,
        items: [],
      };
    }

    const url = `https://serpapi.com/search.json?engine=ebay&_nkw=${encodeURIComponent(
      query
    )}&api_key=${process.env.SERPAPI_KEY}&ebay_domain=ebay.co.uk&sort=best_match&sold_items=true`;

    const res = await axios.get(url, { timeout: 7000 });
    const items = res.data.shopping_results ?? [];

    const rawPrices: number[] = [];

    for (const item of items) {
      if (typeof item.extracted_price === "number") {
        const p = priceForPack(item.title, item.extracted_price, wantedCount);
        if (p !== null) rawPrices.push(p);
      }

      if (item.price) {
        const listed = parseFloat(
          String(item.price).replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const p = priceForPack(item.title, listed, wantedCount);
        if (p !== null) rawPrices.push(p);
      }
    }

    const prices = filterOutliers(rawPrices);

    if (!prices.length) {
      return {
        average: null,
        lowest: null,
        highest: null,
        smartPrice: null,
        googlePriceMin: null,
        googlePriceMax: null,
        usedPrice: null,
        retailPrice: null,
        soldCount: 0,
        demandScore: 0,
        items: [],
      };
    }

    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;

    const smartPrice = Number((average * 0.9).toFixed(2));

    return {
      average,
      lowest,
      highest,

      smartPrice,
      googlePriceMin: lowest,
      googlePriceMax: highest,

      usedPrice: average,
      retailPrice: highest,

      soldCount: prices.length,
      demandScore: Math.min(100, prices.length * 5),

      sellThroughRating: Math.min(100, prices.length * 4),

      ebayData: { items },
      items,
      confidence: 80,
    };
  } catch (err: any) {
    console.log("eBay Market Error:", err?.message || err);

    return {
      average: null,
      lowest: null,
      highest: null,
      smartPrice: null,
      googlePriceMin: null,
      googlePriceMax: null,
      usedPrice: null,
      retailPrice: null,
      soldCount: 0,
      demandScore: 0,
      items: [],
    };
  }
}
