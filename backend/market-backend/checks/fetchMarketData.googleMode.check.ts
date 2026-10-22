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
    // One product ("9000") gets real shop listings back, to see an answer that includes Google being remembered.
    if (String(url).includes("Quux%209000")) {
      const shop = (p: number) => ({ title: "Acme Quux 9000 Gizmo", extracted_price: p, price: `£${p}.00` });
      return { data: { shopping_results: [shop(100), shop(110), shop(120)] } };
    }
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
  eq("unset is pro: Google for subscribers only", mode(undefined), "pro");
  eq("empty is pro", mode(""), "pro");
  eq("when-needed (the old default, for everybody)", mode("when-needed"), "when-needed");
  eq("pro", mode("pro"), "pro");
  eq("always", mode("always"), "always");
  eq("ALWAYS with spaces", mode("  ALWAYS "), "always");
  eq("off", mode("off"), "off");
  eq("Off with a space", mode(" Off"), "off");
  eq("anything else is pro", mode("nonsense"), "pro");

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

  // pro (the default): a Google search only for a subscriber, and only the caller's say-so lets one happen
  delete process.env.GOOGLE_SHOPPING;
  const before = googleSearches();
  await fetchMarketData("Acme Quux 5000 Gizmo", { condition: "used" });
  eq("pro: with no say-so from the caller, Google is not searched", googleSearches(), before);
  let asked = 0;
  await fetchMarketData("Acme Quux 6000 Gizmo", { condition: "used", googleAllowed: async () => { asked++; return false; } });
  eq("pro: the caller is asked (nothing from eBay, so the item is thin)", asked, 1);
  eq("pro: a caller who is not a subscriber gets no Google search", googleSearches(), before);
  await fetchMarketData("Acme Quux 7000 Gizmo", { condition: "used", googleAllowed: async () => true });
  eq("pro: a subscriber, on an item worth it, gets the Google search", googleSearches(), before + 1);
  await fetchMarketData("Acme Quux 8000 Gizmo", { condition: "used", googleAllowed: async () => { throw new Error("RevenueCat down"); } });
  eq("pro: if the subscription check fails, it is treated as not subscribed (no Google, no crash)", googleSearches(), before + 1);

  // An answer given without Google only because the caller is not a subscriber is not remembered, so a subscriber who scans the
  // same item straight after still gets the search they pay for...
  await fetchMarketData("Acme Quux 9000 Gizmo", { condition: "used", googleAllowed: async () => false });
  eq("pro: a free user's scan of a thin item does not search", googleSearches(), before + 1);
  await fetchMarketData("Acme Quux 9000 Gizmo", { condition: "used", googleAllowed: async () => true });
  eq("pro: a subscriber scanning the same item straight after a free user still gets their search", googleSearches(), before + 2);
  // ...and once an answer that includes Google is remembered, whoever asks next shares it: no second search to pay for.
  const shared = await fetchMarketData("Acme Quux 9000 Gizmo", { condition: "used", googleAllowed: async () => false });
  eq("pro: an answer that already includes Google is shared with the next person, no second search", googleSearches(), before + 2);
  eq("pro: and it carries the Google prices", shared.googlePriceMax != null, true);

  console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
  process.exit(fail ? 1 : 0);
})();
