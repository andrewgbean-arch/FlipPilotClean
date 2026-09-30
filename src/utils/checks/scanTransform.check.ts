// Run with: npx tsx src/utils/checks/scanTransform.check.ts (from the app root).
// Found live 2026-09-30, right after shipping the "Trending on eBay" card and the pack-count-aware
// listing description: neither ever worked. pickMarket() (the whitelist every market object passes
// through before scan-results.tsx reads it) never forwarded `ebay`, so the eBay card's own guard
// (data.market?.ebay?.lowest != null) was always false — confirmed via `git show --stat 5e4c629`,
// which shows that commit only touched scan-results.tsx and api.ts, never this file, even though its
// own commit message says "Reuses market.ebay.lowest/highest/soldCount, already on every response."
// Separately, transformIdentity never copied the backend's own `packCount` field onto `ai.packCount`,
// so SellerDescriptionCard (app/scan/scan-results.tsx) always got packCount=null, even for a barcode
// scan the backend itself had correctly identified as, say, an 80-lozenge multipack.
import { applyPrices, pickMarket, transformIdentity } from "../scanTransform";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// pickMarket forwards eBay's own range — nested under market.ebay in the real /price response
// (backend/market-backend/fetchMarketData.ts's MarketEvidence.ebay), not at the top level (the
// top-level lowest/highest are the Google-driven overall range, a different thing entirely).
const withEbay = pickMarket({ ebay: { lowest: 5, highest: 12, soldCount: 3 }, googlePriceMin: 10 });
eq("ebay.lowest is forwarded", withEbay.ebay?.lowest, 5);
eq("ebay.highest is forwarded", withEbay.ebay?.highest, 12);
eq("ebay.soldCount is forwarded", withEbay.ebay?.soldCount, 3);
eq("other market fields still forwarded", withEbay.googlePriceMin, 10);

// No eBay data at all: the card's own guard needs `ebay` to be null, not an object of nulls.
const withoutEbay = pickMarket({ ebay: { lowest: null, highest: null, soldCount: 0 }, googlePriceMin: 10 });
eq("no ebay data: ebay is null, not {}", withoutEbay.ebay, null);

// Only one of lowest/highest present still counts as having eBay data (the render guard checks both
// independently; pickMarket's job is only to forward what's there, not to decide what renders).
const partialEbay = pickMarket({ ebay: { lowest: 5, highest: null, soldCount: 0 } });
eq("only lowest present: still forwarded", partialEbay.ebay?.lowest, 5);
eq("only lowest present: highest is null", partialEbay.ebay?.highest, null);

// A missing market object entirely (the very first render, before any lookup) must not throw.
const noMarket = pickMarket(null);
eq("no market at all: ebay is null, no throw", noMarket.ebay, null);

// transformIdentity: packCount from the identify-step response reaches ai.packCount.
const identity = transformIdentity({ title: "Nicorette Cools 80 Lozenges", packCount: 80 });
eq("packCount reaches ai.packCount", identity.ai.packCount, 80);

// No packCount on the identify response (most items): stays null, not undefined-turned-NaN.
const identityNoPack = transformIdentity({ title: "Random Item" });
eq("no packCount: ai.packCount is null", identityNoPack.ai.packCount, null);

// applyPrices (step 2, "what is it worth?") must not wipe out what step 1 already set — it only
// spreads ...data.ai and overrides specific fields, so packCount set at identify time must survive.
const priced = applyPrices(identity, { pricing: { recommendedBuyPrice: 4, recommendedSellPrice: 8 }, market: {} });
eq("packCount survives applyPrices", priced.ai.packCount, 80);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
