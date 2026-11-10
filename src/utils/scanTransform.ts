import { ebayNewRange, pickEbayCards } from "./ebayListings";

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
export const pickMarket = (market: any) => ({
  demandScore: market?.demandScore ?? null,
  googlePriceMin: market?.googlePriceMin ?? null,
  googlePriceMax: market?.googlePriceMax ?? null,
  // The typical shop price (not the single dearest listing, which can be another model): what the "Retail price" row shows. null on a reply, or a
  // saved result, that predates it; the row then falls back to googlePriceMax (see retailPriceToShow).
  googleShelfPrice: market?.googleShelfPrice ?? null,
  // How many shop listings stand behind those two figures after filtering; null on a reply (or a
  // saved result) that predates it. See evidenceDepth.ts.
  googleCount: market?.googleCount ?? null,
  // False when Google was deliberately not searched (eBay alone was enough); null if not reported.
  googleSearched: market?.googleSearched ?? null,
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
  // True when the server gave no price because the AI does not know this make and nothing real was found to price it from; the
  // result then says so (see isUnrecognised in the backend). null on a reply, or a saved result, that predates it.
  unrecognised: market?.unrecognised ?? null,
  // Whether the AI said it actually knows this make and model: false for a photo that only shows what kind of thing it is, or an unfamiliar brand
  // (see guessedFromTheName). null when it did not say, or on a reply that predates it.
  aiRecognised: market?.aiRecognised ?? null,
  // eBay's own asking-price range, shown in the "On eBay right now" block — informational only,
  // not blended into the prices above. Dropped here until 2026-09-30, so that block (then called
  // "Trending on eBay") never rendered for anyone: the backend has always sent it, this whitelist
  // just never forwarded it. Only these three numbers: the listings themselves are NOT kept here
  // (see applyPrices).
  ebay:
    market?.ebay?.lowest != null || market?.ebay?.highest != null
      ? {
          lowest: market.ebay.lowest ?? null,
          highest: market.ebay.highest ?? null,
          soldCount: market.ebay.soldCount ?? null,
        }
      : null,
});

// The figure for the result screen's "Retail price" row: the typical shop price when the server sent one, otherwise the dearest shop listing (an older reply, or a
// result saved before the typical price was kept). The dearest listing alone can be another model of the same make: a Duotts C29 showed "Retail price £1,264", the
// price of the C29-K, when the C29 itself is £660 to £999 in the shops (found 10 Nov 2026), so it is only the fallback.
export const retailPriceToShow = (market: any): number | null => {
  const typical = market?.googleShelfPrice;
  if (typeof typical === "number" && Number.isFinite(typical) && typical > 0) return typical;
  const dearest = market?.googlePriceMax;
  return typeof dearest === "number" && Number.isFinite(dearest) ? dearest : null;
};

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
    // Set here, at identify time, and left alone by applyPrices below (it only spreads ...data.ai
    // and overrides specific fields) — /price never echoes packCount back, so this is the one place
    // it can be read from.
    packCount: input?.packCount ?? null,
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
  // Only a typed make and model is marked; the result screen then says "Typed in" where a photo scan says "Identified from photo".
  source: input?.source === "typed" ? "typed" : null,
  pendingId: options.pendingId ?? null,
  // Sent back with every price lookup for this scan.
  scanToken: input?.scanToken ?? null,
});

// The listings for the "On eBay right now" block: eBay's used ones. When it has no used one but has new ones, those instead, with their
// own range (`ebayNew`, set only then), because the block says they are new; they never feed a price (see newListingsToShow in the backend).
const ebayBlock = (market: any) => {
  const used = pickEbayCards(market);
  if (used.length > 0) return { ebayCards: used, ebayNew: null };
  const range = ebayNewRange(market);
  const cards = range ? pickEbayCards(market, undefined, "new") : [];
  return { ebayCards: cards, ebayNew: cards.length > 0 ? range : null };
};

// Step 2 ("what is it worth?"): fold the price lookup into the result already on screen.
export const applyPrices = (data: any, res: any, now: number = Date.now()): Record<string, any> => ({
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
  // The eBay listings behind eBay's range, for the "On eBay right now" block, and when they were checked. Kept
  // beside `market`, never inside it: `market` is what a saved flip stores, while eBay's licence wants listing
  // details kept fresh and gone when the listing is, so these live only on the screen (see ebayListings.ts).
  ...ebayBlock(res?.market),
  ebayCheckedAt: now,
});
