// Run with: npx tsx market-backend/checks/fetchMarketData.dearerQuartile.check.ts (from the backend folder).
// Google Shopping's own "shelf price" used to be the lower quartile of what it found, as a hedge
// against unlabelled multipacks — a hedge that's now redundant (priceForPack/isBulkListing already
// filter those per listing) and was quietly undershooting real prices all day (a De'Longhi Rivelia's
// own real £449-808 UK listings, correctly matched, still landed low as "the" price). Requested
// live: lean toward the dearer end of what Google genuinely found, not the cheap end.
import { dearerQuartile } from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

eq("empty list", dearerQuartile([]), null);
eq("a single price", dearerQuartile([50]), 50);

// The real reported shape: several genuine De'Longhi Rivelia listings, correctly matched, ranging
// £449.99-£808.99 — picks a real listing on the upper side, not the cheapest or the middle.
{
  const prices = [449.99, 577.15, 599.99, 603.69, 620.72, 686.93, 749.99, 764, 808.99];
  const got = dearerQuartile(prices)!;
  if (!(got >= 686.93 && got <= 808.99)) {
    fail++;
    console.log("FAIL real Rivelia listings land on the upper side", got);
  }
  // Specifically: strictly above the median (620.72), never the cheap end.
  if (!(got > 620.72)) {
    fail++;
    console.log("FAIL strictly above the median, not just at or below it", got);
  }
}

// A small, evenly-spaced set: the upper quartile is dearer than a plain average would be.
{
  const prices = [10, 20, 30, 40];
  const got = dearerQuartile(prices)!;
  const average = prices.reduce((a, b) => a + b, 0) / prices.length; // 25
  if (!(got > average)) {
    fail++;
    console.log("FAIL dearer than a plain average", got, "vs average", average);
  }
}

// Never picks something dearer than the most expensive real listing, or cheaper than the cheapest.
{
  const prices = [15, 22, 22, 40, 100];
  const got = dearerQuartile(prices)!;
  if (!(got >= Math.min(...prices) && got <= Math.max(...prices))) {
    fail++;
    console.log("FAIL stays within the real range", got);
  }
}

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
