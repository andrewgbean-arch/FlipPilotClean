// Sent by scan-results ("Scan Again") so the Scan tab knows the user asked to scan again
// and can resume barcode scanning, which otherwise waits for a tap after every scan.
export const SCAN_AGAIN_EVENT = "flippilot:scan-again";

// The vision prompt only asks for "a number", so the model may answer 0-1 or 0-100. Show one scale.
export const normalizeConfidence = (raw: unknown): number | null => {
  const n = Number(raw);
  if (raw == null || raw === "" || !Number.isFinite(n)) return null;
  const percent = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

// Only the numbers that scan-results and History use. The raw market object also carries every
// eBay and Google listing, which would all be pushed through the route params.
const pickMarket = (market: any) => ({
  demandScore: market?.demandScore ?? null,
  googlePriceMin: market?.googlePriceMin ?? null,
  googlePriceMax: market?.googlePriceMax ?? null,
  smartPrice: market?.smartPrice ?? null,
  // What one new unit costs in the shops: the reference the sell and buy prices are worked from.
  retailPrice: market?.retailPrice ?? null,
  lowest: market?.lowest ?? null,
  highest: market?.highest ?? null,
  average: market?.average ?? null,
  soldCount: market?.soldCount ?? null,
  aiPriceMin: market?.aiPriceMin ?? null,
  aiPriceMax: market?.aiPriceMax ?? null,
  aiPriceConfidence: market?.aiPriceConfidence ?? null,
});

// `/search` and `/search-image` return { ai, market, pricing, flipScore, image, title, barcode, ... }.
// scan-results.tsx expects { title, barcode, ai: { fair_price, suggested_buy, suggested_sell, flip_score }, image }.
export const transformScanResult = (input: any, imageUri?: string) => ({
  title: input?.title ?? input?.ai?.title ?? "Unknown Item",
  barcode: input?.barcode ?? null,
  base_price: input?.pricing?.recommendedBuyPrice ?? null,
  ai: {
    ...input?.ai,
    confidence: normalizeConfidence(input?.ai?.confidence),
    fair_price: input?.market?.average ?? input?.pricing?.recommendedSellPrice ?? null,
    suggested_buy: input?.pricing?.recommendedBuyPrice ?? null,
    suggested_sell: input?.pricing?.recommendedSellPrice ?? null,
    flip_score: input?.flipScore ?? 0,
  },
  market: pickMarket(input?.market),
  flipPotential: input?.flipPotential ?? null,
  sellSpeed: input?.sellSpeed ?? null,
  rarity: input?.rarity ?? null,
  insights: input?.insights ?? null,
  aiPriceMin: input?.aiPriceMin ?? null,
  aiPriceMax: input?.aiPriceMax ?? null,
  aiPriceConfidence: input?.aiPriceConfidence ?? null,
  image: imageUri ?? input?.image ?? null,
});

// Step 1 of a scan ("what is it?"): enough to open the result screen straight away. The
// prices arrive a moment later (see applyPrices), so the price fields start empty.
export const transformIdentity = (
  input: any,
  options: { imageUri?: string | null; pendingId?: string } = {}
): Record<string, any> => ({
  title: input?.title ?? "Unknown Item",
  barcode: input?.barcode ?? null,
  base_price: null,
  ai: {
    title: input?.title ?? null,
    category: input?.category ?? null,
    condition: input?.condition ?? null,
    description: null,
    confidence: normalizeConfidence(input?.confidence),
    fair_price: null,
    suggested_buy: null,
    suggested_sell: null,
    flip_score: 0,
  },
  market: pickMarket(null),
  flipPotential: null,
  sellSpeed: null,
  rarity: null,
  insights: null,
  aiPriceMin: null,
  aiPriceMax: null,
  aiPriceConfidence: null,
  image: options.imageUri ?? input?.image ?? null,
  pendingId: options.pendingId ?? null,
});

// Step 2 ("what is it worth?"): fold the price lookup into the result already on screen.
export const applyPrices = (data: any, res: any): Record<string, any> => ({
  ...data,
  base_price: res?.pricing?.recommendedBuyPrice ?? null,
  ai: {
    ...data?.ai,
    // The description and other details written while the prices were looked up.
    description: res?.ai?.description ?? data?.ai?.description ?? null,
    fullDescription: res?.ai?.fullDescription ?? data?.ai?.fullDescription ?? null,
    conditionScore: res?.ai?.conditionScore ?? data?.ai?.conditionScore ?? null,
    origin: res?.ai?.origin ?? data?.ai?.origin ?? null,
    condition: data?.ai?.condition ?? res?.ai?.condition ?? null,
    fair_price: res?.market?.average ?? res?.pricing?.recommendedSellPrice ?? null,
    suggested_buy: res?.pricing?.recommendedBuyPrice ?? null,
    suggested_sell: res?.pricing?.recommendedSellPrice ?? null,
    flip_score: res?.flipScore ?? 0,
  },
  market: pickMarket(res?.market),
  flipPotential: res?.flipPotential ?? null,
  sellSpeed: res?.sellSpeed ?? null,
  rarity: res?.rarity ?? null,
  insights: res?.insights ?? null,
  aiPriceMin: res?.aiPriceMin ?? null,
  aiPriceMax: res?.aiPriceMax ?? null,
  aiPriceConfidence: res?.aiPriceConfidence ?? null,
});
