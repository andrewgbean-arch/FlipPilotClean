// Run with: npx tsx market-backend/checks/fetchMarketData.ebayIsStrong.check.ts (from the backend folder).
// Whether eBay alone is trusted, or Google Shopping's paid search is also worth paying for.
// Found live 2026-09-28: a De'Longhi Rivelia priced from eBay's own "new condition" listings
// (tight among themselves at ~£535, itself already well under its real ~£650 retail price) while
// the AI's own guess said £150 — eBay technically had "enough" listings, but the two independent
// opinions disagreed by 3.5x, and nothing noticed. All three checks below target cases like this.
import { ebayIsStrong } from "../fetchMarketData";
import type { EbayMarketResult } from "../ebayMarket";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// A minimal, real-shaped result: `n` listings evenly spread from `lowest` to `highest`.
function listings(n: number, lowest: number, highest: number): EbayMarketResult {
  const items = Array.from({ length: n }, () => ({}));
  return { average: (lowest + highest) / 2, lowest, highest, items } as EbayMarketResult;
}

// A healthy, tight, agreeing, inexpensive market: strong.
eq(
  "plenty of listings, tight spread, AI agrees, cheap enough: strong",
  ebayIsStrong(listings(6, 60, 90), listings(4, 150, 180), true, 165),
  true
);

// Too few listings: not strong (existing behaviour, unaffected).
eq("too few used listings: not strong", ebayIsStrong(listings(3, 60, 90), listings(4, 150, 180), true, 165), false);
eq("too few new listings: not strong", ebayIsStrong(listings(6, 60, 90), listings(2, 150, 180), true, 165), false);

// Plenty of listings but scattered across too wide a range: not strong, regardless of headcount.
eq(
  "wide spread despite enough listings: not strong",
  ebayIsStrong(listings(6, 60, 90), listings(5, 50, 190), true, 120),
  false
);

// The exact De'Longhi shape: eBay's own new-condition listings agree with EACH OTHER (tight,
// ~£535), but flatly disagree with the AI's £150 guess — not strong (also genuinely high-value,
// so all three checks agree here, which is realistic: a real disagreement this size on a rare
// item tends to show up more than one way at once).
eq(
  "eBay internally consistent but far from the AI's guess: not strong",
  ebayIsStrong(listings(10, 330, 450), listings(5, 500, 570), true, 150),
  false
);

// The two sources roughly agreeing (within 2x), and cheap enough, is untouched.
eq(
  "eBay and AI roughly agree, cheap enough: still strong",
  ebayIsStrong(listings(6, 60, 90), listings(5, 150, 190), true, 200),
  true
);

// No AI estimate at all (a timeout, or it's disabled) never blocks eBay being trusted on its own,
// as long as it's cheap enough and consistent.
eq("no AI estimate, cheap enough: strength decided by eBay alone", ebayIsStrong(listings(6, 60, 90), listings(5, 150, 190), true, null), true);

// A sealed/new item (not used): only the main `ebay` result matters, checked against the AI.
eq(
  "sealed item: ebayNew is irrelevant, ebay itself is checked",
  ebayIsStrong(listings(6, 90, 110), null, false, 95),
  true
);
eq(
  "sealed item where ebay disagrees with the AI: not strong",
  ebayIsStrong(listings(6, 90, 110), null, false, 30),
  false
);

// Boundary: exactly the allowed spread/gap/value still counts as strong (never rounds against
// the user) — one penny or one pound over any of them does not.
eq("spread exactly at the limit (3x): still strong", ebayIsStrong(listings(6, 60, 180), listings(5, 150, 190), true, 200), true);
eq("AI gap exactly at the limit (2x): still strong", ebayIsStrong(listings(6, 60, 90), listings(5, 150, 190), true, 85), true);
eq(
  "genuinely high-value, otherwise perfectly strong: Google is worth it anyway",
  ebayIsStrong(listings(6, 60, 90), listings(5, 240, 260), true, 250),
  false
);
eq("value exactly at the £200 limit: still strong", ebayIsStrong(listings(6, 60, 90), listings(5, 180, 220), true, 200), true);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
