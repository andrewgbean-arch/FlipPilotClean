// Run with: npx tsx market-backend/checks/fetchMarketData.parseListedPrice.check.ts (from the backend folder).
// Found live 2026-09-30: fetchGoogleShopping's price parsing swapped only the FIRST comma for a
// dot before calling parseFloat. When extracted_price is missing (a real, occasionally-absent
// SerpAPI field) and the fallback is the formatted `price` string, a price with a thousands
// separator — "£1,299.99" — became "1.299.99" after that swap, and parseFloat stops at the second
// dot: 1.299, not 1299.99. A real, expensive item's price silently landing about 1000x too low.
import { parseListedPrice } from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

eq("a price with a thousands separator", parseListedPrice("£1,299.99"), 1299.99);
eq("the exact real case, no currency symbol", parseListedPrice("1,299.99"), 1299.99);
eq("a smaller price with no thousands separator, unaffected", parseListedPrice("£86.94"), 86.94);
eq("a whole-pound price with a thousands separator", parseListedPrice("£2,500"), 2500);
eq("a number, not a string, from extracted_price", parseListedPrice(449.99), 449.99);
eq("a six-figure price with two thousands separators", parseListedPrice("£12,499.50"), 12499.5);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
