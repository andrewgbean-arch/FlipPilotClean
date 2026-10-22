// Run with: npx tsx market-backend/checks/fetchMarketData.googleMode.check.ts (from the backend folder).
// GOOGLE_SHOPPING=off never searches Google, and the two Google-only fields ("Retail price", "Trends around") are no longer filled with
// the AI's USED price range when Google was skipped or found nothing. The network is replaced, so nothing real is called or paid for.
import "./tempDataDir"; // first: keeps the cost log out of the real data folder
import axios from "axios";
import fetchMarketData, { googleShoppingMode } from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) {
    fail++;
    console.log("FAIL", label, "got", got, "want", want);
  }
};

(async () => {
  for (const k of ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "CLIENT_ID", "CLIENT_SECRET", "API_KEY"]) delete process.env[k];
  process.env.OPENAI_API_KEY = "test-key";
  process.env.SERPAPI_KEY = "test-key";

  const searched: string[] = [];
  (axios as any).get = async (url: string) => {
    searched.push(String(url));
    return { data: { shopping_results: [] } }; // Google answers, but finds nothing usable
  };
  (axios as any).post = async () => ({
    data: {
      choices: [{ message: { content: JSON.stringify({ newPrice: 100, usedMin: 40, usedMax: 60, confidence: 80 }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    },
  });
  const googleSearches = () => searched.filter((u) => u.includes("serpapi.com")).length;

  // the mode setting
  const mode = (v?: string) => {
    if (v === undefined) delete process.env.GOOGLE_SHOPPING;
    else process.env.GOOGLE_SHOPPING = v;
    return googleShoppingMode();
  };
  eq("unset is when-needed", mode(undefined), "when-needed");
  eq("empty is when-needed", mode(""), "when-needed");
  eq("when-needed", mode("when-needed"), "when-needed");
  eq("always", mode("always"), "always");
  eq("ALWAYS with spaces", mode("  ALWAYS "), "always");
  eq("off", mode("off"), "off");
  eq("Off with a space", mode(" Off"), "off");
  eq("anything else is when-needed", mode("nonsense"), "when-needed");

  // off: Google is never searched, and nothing pretends the AI's used range is Google's retail price
  process.env.GOOGLE_SHOPPING = "off";
  const off = await fetchMarketData("Acme Quux 3000 Widget", { condition: "used" });
  eq("off: Google was never searched", googleSearches(), 0);
  eq("off: the Retail price field is empty", off.googlePriceMax, null);
  eq("off: the Trends around field is empty", off.googlePriceMin, null);
  eq("off: the AI's own used range is still returned as the AI range", off.aiPriceMax, 60);
  eq("off: the screen's overall range still falls back to the AI", off.highest, 60);

  // always: Google is searched; when it finds nothing the fields are still empty (not the AI's used range)
  process.env.GOOGLE_SHOPPING = "always";
  const always = await fetchMarketData("Acme Quux 4000 Gadget", { condition: "used" });
  eq("always: Google was searched", googleSearches(), 1);
  eq("always, Google found nothing: the Retail price field is empty, not the AI's used maximum", always.googlePriceMax, null);
  eq("always, Google found nothing: the Trends around field is empty, not the AI's used minimum", always.googlePriceMin, null);
  eq("always, Google found nothing: no 20 confidence points for a Google range nobody had", always.confidence < 45, true);

  console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
  process.exit(fail ? 1 : 0);
})();
