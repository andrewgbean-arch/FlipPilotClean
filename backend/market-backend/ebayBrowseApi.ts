import axios from "axios";
import { EbayMarketResult } from "./ebayMarket";
import { isNotTheItem, matchesQuery, priceForPack } from "./bulkListingFilter";
import { recordCost } from "../utils/costLog";

/* --------------------------------------------------
   ⭐ eBay Browse API (official, OAuth2 client-credentials)

   Replaces the SerpAPI-scraped `sold_items=true` eBay lookup, which has
   become unreliable since eBay put its "Sold Items" filter behind a
   login wall (breaks scrapers, frequent hangs/timeouts — see
   ebayMarket.ts). This is eBay's own supported API, so it doesn't
   depend on scraping their search UI at all.

   Trade-off to be aware of: the Browse API only searches CURRENT LIVE
   listings — there is no free/self-serve access to actual sold prices
   (that requires eBay's separate, approval-gated Marketplace Insights
   API). So this gives real asking prices, not confirmed sold prices.
   Asking prices on eBay tend to sit a bit above what things actually
   sell for, which fetchMarketData.ts accounts for with a modest
   markdown when treating this as the "used/resale" reference.
-------------------------------------------------- */

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getEbayAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const res = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    body.toString(),
    {
      timeout: 5000,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, expires_in } = res.data;
  tokenCache = {
    token: access_token,
    expiresAt: Date.now() + Number(expires_in ?? 7200) * 1000,
  };

  return access_token;
}

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

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * `condition` narrows the search to what the scanned item actually is: a used
 * speaker is worth what used speakers sell for, not what a new one costs.
 * "used" and "new" ask eBay for that condition only; null asks for everything.
 */
export default async function fetchEbayBrowseMarket(
  query: string,
  wantedCount?: number | null,
  condition?: "new" | "used" | null
): Promise<EbayMarketResult> {
  const empty: EbayMarketResult = {
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

  if (!query) return empty;

  try {
    const token = await getEbayAccessToken();

    const search = (filter?: string) => {
      recordCost("ebay", "browse-search");
      return axios.get("https://api.ebay.com/buy/browse/v1/item_summary/search", {
        timeout: 6000,
        params: {
          q: query,
          limit: 50,
          ...(filter ? { filter } : {}),
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        },
      });
    };

    const conditionFilter =
      condition === "used"
        ? "conditions:{USED},buyingOptions:{FIXED_PRICE}"
        : condition === "new"
        ? "conditions:{NEW},buyingOptions:{FIXED_PRICE}"
        : undefined;

    let summaries: any[] = [];
    try {
      summaries = (await search(conditionFilter)).data.itemSummaries ?? [];
    } catch (err: any) {
      // A category that doesn't take the filter must not lose the whole lookup.
      if (!conditionFilter) throw err;
    }
    if (summaries.length < 3 && conditionFilter) {
      summaries = (await search()).data.itemSummaries ?? [];
    }

    const rawPrices: number[] = [];
    const items: any[] = [];

    // Prefer listings for the same product (not the next model up); if that
    // leaves too few, use them all rather than nothing.
    const sameProduct = summaries.filter((i: any) => matchesQuery(i?.title, query));
    const pool = sameProduct.length >= 3 ? sameProduct : summaries;

    for (const item of pool) {
      // Accessories, spares and faulty units are not the item.
      if (isNotTheItem(item?.title, query)) continue;
      if (/parts|not working|faulty/i.test(String(item?.condition ?? ""))) continue;

      // Scaled to the scanned pack size where the listing says its own; dropped if bulk.
      const listed = parseFloat(item?.price?.value);
      const value = priceForPack(item?.title, listed, wantedCount) ?? NaN;
      if (isNaN(value)) continue;
      rawPrices.push(value);

      items.push({
        title: item?.title ?? query,
        price: item?.price?.value ? `£${item.price.value}` : undefined,
        extracted_price: !isNaN(value) ? value : undefined,
        thumbnail: item?.image?.imageUrl ?? item?.thumbnailImages?.[0]?.imageUrl ?? null,
        link: item?.itemWebUrl ?? null,
        condition: item?.condition ?? null,
      });
    }

    const prices = filterOutliers(rawPrices);

    if (!prices.length) {
      return { ...empty, items };
    }

    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    // The middle price, not the mean: a few premium or oddly priced listings
    // shouldn't move it.
    const askingAverage = median(prices);

    // These are live asking prices, not confirmed sold prices — items sit
    // on eBay at their asking price for a while before either selling for
    // less (offers/haggling) or not selling at all, so treat the average
    // as somewhat optimistic relative to real resale value.
    const average = Number((askingAverage * 0.9).toFixed(2));

    return {
      average,
      lowest,
      highest,
      smartPrice: Number((average * 0.9).toFixed(2)),
      googlePriceMin: lowest,
      googlePriceMax: highest,
      usedPrice: average,
      retailPrice: highest,
      soldCount: prices.length,
      demandScore: Math.min(100, prices.length * 3),
      sellThroughRating: null,
      ebayData: { items },
      items,
      confidence: 70,
    };
  } catch (err: any) {
    console.log("eBay Browse API Error:", err?.response?.data ?? err?.message ?? err);
    return empty;
  }
}
