/**
 * The shape of an eBay price result. The eBay Browse API (ebayBrowseApi.ts) is
 * the only source of eBay data. There used to be a second path that scraped
 * eBay search pages through SerpAPI; it was removed because eBay's API License
 * Agreement does not allow using eBay content obtained that way.
 */
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
