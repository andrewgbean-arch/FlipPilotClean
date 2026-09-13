// `/search` and `/search-image` return { ai, market, pricing, flipScore, image, title, barcode, ... }.
// scan-results.tsx expects { title, barcode, ai: { fair_price, suggested_buy, suggested_sell, flip_score }, image }.
export const transformScanResult = (input: any, imageUri?: string) => ({
  title: input?.title ?? input?.ai?.title ?? "Unknown Item",
  barcode: input?.barcode ?? null,
  base_price: input?.pricing?.recommendedBuyPrice ?? null,
  ai: {
    ...input?.ai,
    fair_price: input?.market?.average ?? input?.pricing?.recommendedSellPrice ?? null,
    suggested_buy: input?.pricing?.recommendedBuyPrice ?? null,
    suggested_sell: input?.pricing?.recommendedSellPrice ?? null,
    flip_score: input?.flipScore ?? 0,
  },
  market: input?.market ?? {},
  image: imageUri ?? input?.image ?? null,
});
