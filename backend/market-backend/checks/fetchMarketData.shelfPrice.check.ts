// Run with: npx tsx market-backend/checks/fetchMarketData.shelfPrice.check.ts (from the backend folder).
// The result screen's "Retail price" row used to show the DEAREST shop listing that survived filtering. Found 10 Nov 2026 on a typed "Duotts C29": of 11
// matching shop listings the dearest was "DUOTTS C29-K Electric Bike" at £1,264 (another model; the C29 Lite and C29-S are in there too), so the screen printed
// "Retail price £1264.00" beside £660 to £999 for the C29 itself. The server now also sends the typical shop price (googleShelfPrice, the dearer quartile, the same figure
// the price is worked from) and the screen shows that. The shop results below are the real 40 Google Shopping results for "Duotts C29" (title and price only);
// the network is replaced, so nothing real is called or paid for.
import "./tempDataDir"; // first: keeps the cost log out of the real data folder
import axios from "axios";
import fetchMarketData from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) {
    fail++;
    console.log("FAIL", label, "got", got, "want", want);
  }
};

const DUOTTS_SHOP = [
  { title: "Duotts C29 E-bike 21-Speed Shimano Gears 750W Brushless Motor", extracted_price: 799 },
  { title: "DUOTTS C29 Electric Bike Ship to UK", extracted_price: 710.18 },
  { title: "DUOTTS C29 Electric Mountain Bike 29 inch 48V 15Ah 750W E-MTB EBIKE", extracted_price: 999 },
  { title: "DUOTTS C29-K Electric Bike", extracted_price: 1264 },
  { title: "Duotts C29 Electric Bike Black", extracted_price: 499.99 },
  { title: "Duotts C29 e-bike (750W) 48V (DCJ 2.1) 15AH Li-Ion Battery Charger", extracted_price: 69.8 },
  { title: "DUOTTS C29 Electric Bike", extracted_price: 660.05 },
  { title: "C29 Light & Horn Switch", extracted_price: 16.63 },
  { title: "Duotts C29-S electric bike – 48 V 12 Ah, up to 60 km", extracted_price: 899 },
  { title: "C29", extracted_price: 25.07 },
  { title: "Duotts C29 Lite electric bike – 36 V 13 Ah, up to 65 km", extracted_price: 899 },
  { title: "Vélo Électrique DUOTTS C29 Lite Moteur 250 W", extracted_price: 563.8 },
  { title: "DUOTTS E-Bike Battery", extracted_price: 289 },
  { title: "Duotts C29 Bike,48v15ah+15ah Battery,750 Motor E Mountain Bike 33mph", extracted_price: 866.99 },
  { title: "Duotts C29 2024", extracted_price: 584.86 },
  { title: "Duotts C29MAX City Electric Bike Smart Torque Sensor 65 Nm Torque", extracted_price: 818.63 },
  { title: "DUOTTS C29 Electric Bike Charger 48V-54.6V 2A", extracted_price: 39 },
  { title: "Duotts C29 Hydraulic Brake", extracted_price: 90 },
  { title: "Rear Light for Duotts C29 Electric Bicycle Tail Light Replacement Part", extracted_price: 14 },
  { title: "Pedals for Duotts C29", extracted_price: 28 },
  { title: "Dualit NewGen 2 Slice Toaster", extracted_price: 174.99 },
  { title: "Front Light for Duotts C29 Electric Bicycle Headlight E-Bike Front Lamp Parts", extracted_price: 20 },
  { title: "Duravit D-Code Toilet Floorstanding 480mm Washdown", extracted_price: 94.92 },
  { title: "eufy Omni C28 Robot Vacuum & Mop with All-in-One Station", extracted_price: 399 },
  { title: "Rear Hub Motor for Duotts C29", extracted_price: 259 },
  { title: "Dualit Classic 2 Vario Toaster", extracted_price: 184.99 },
  { title: "Front Light for Duotts C29 Max Electric Bicycle Headlight E-Bike Front Lamp Parts", extracted_price: 22 },
  { title: "OneSportLife 1 Pair Hydraulic Disc Brake Set for Electric Bike, Aluminum Alloy Hydraulic Disc Brakes, E-bike Brake for DUOTTS C29", extracted_price: 79.99 },
  { title: "Controller for Duotts C29", extracted_price: 89 },
  { title: "AIR 20 Ultra 2026 folding electric bike | For commuter in the UK Light Blue", extracted_price: 1699 },
  { title: "Staub Cocotte Oval", extracted_price: 241.75 },
  { title: "DYU M20 Vélo électrique Moteur 1000W Batterie 48V 18.2Ah 55KM/h", extracted_price: 799 },
  { title: "AC Adapter Charger Compatible with DUOTTS C29", extracted_price: 48 },
  { title: "Charger for Duotts C29", extracted_price: 44.99 },
  { title: "Vittoria Mota Race Enduro Tyre", extracted_price: 37.55 },
  { title: "AC Adapter Charger Compatible with DUOTTS C29 Electric Bike", extracted_price: 37 },
  { title: "Duotts E29 Electric Bike 48V 13.5AH 27.5 inches mountain Ebike", extracted_price: 1101.68 },
  { title: "Women Dr Martens 1B99 Wg 14 Eye Boot", extracted_price: 229 },
  { title: "Light & Horn Switch for Duotts C29 Electric Bicycle E-Bike Headlight Horn Switch Button Replacement Parts", extracted_price: 16 },
  { title: "Motul Specific Dexos 2 5W30 C3 Fully Synthetic Engine Oil | Multigrade", extracted_price: 1014.54 },
];

(async () => {
  for (const k of ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "CLIENT_ID", "CLIENT_SECRET", "API_KEY"]) delete process.env[k];
  process.env.OPENAI_API_KEY = "test-key";
  process.env.SERPAPI_KEY = "test-key";
  process.env.GOOGLE_SHOPPING = "always";

  (axios as any).get = async (url: string) => {
    if (String(url).includes("Duotts")) return { data: { shopping_results: DUOTTS_SHOP } };
    // A second, ordinary product: three shops, one product, no variants.
    if (String(url).includes("Quux%209000")) {
      const shop = (p: number) => ({ title: "Acme Quux 9000 Gizmo", extracted_price: p, price: `£${p}.00` });
      return { data: { shopping_results: [shop(100), shop(110), shop(120)] } };
    }
    return { data: { shopping_results: [] } };
  };
  // The AI does not know the Duotts brand and guesses £50 for a new one (what it really said on 10 Nov).
  (axios as any).post = async () => ({
    data: {
      choices: [{ message: { content: JSON.stringify({ newPrice: 50, usedMin: 15, usedMax: 25, confidence: 60, recognised: false }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    },
  });

  const duotts = await fetchMarketData("Duotts C29", { condition: "used" });
  eq("duotts: 11 of the 40 shop results are the bike", duotts.googleCount, 11);
  eq("duotts: the dearest survivor is still the C29-K at 1264 (googlePriceMax is unchanged)", duotts.googlePriceMax, 1264);
  eq("duotts: the cheapest survivor is still 499.99", duotts.googlePriceMin, 499.99);
  eq("duotts: the typical shop price is 899, not 1264", duotts.googleShelfPrice, 899);
  eq("duotts: it is the same figure the price is worked from", duotts.googleShelfPrice, (duotts as any).priceInputs?.googleNew);
  eq("duotts: it lies between the cheapest and the dearest", (duotts.googleShelfPrice ?? 0) >= (duotts.googlePriceMin ?? 1e9) && (duotts.googleShelfPrice ?? 1e9) <= (duotts.googlePriceMax ?? 0), true);

  // Few listings, one product: the typical price is the dearest, as the row always showed (nothing changes for an ordinary scan).
  const ordinary = await fetchMarketData("Acme Quux 9000 Gizmo", { condition: "used" });
  eq("ordinary: three listings, the typical price is the dearest, as before", ordinary.googleShelfPrice, 120);
  eq("ordinary: googlePriceMax is unchanged", ordinary.googlePriceMax, 120);

  // Google not searched or nothing found: no typical price either (the screen then hides the row).
  const nothing = await fetchMarketData("Acme Quux 1000 Nothing", { condition: "used" });
  eq("nothing found: no typical price", nothing.googleShelfPrice ?? null, null);
  process.env.GOOGLE_SHOPPING = "off";
  const off = await fetchMarketData("Acme Quux 2000 Skipped", { condition: "used" });
  eq("Google off: no typical price", off.googleShelfPrice ?? null, null);

  console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
  process.exit(fail ? 1 : 0);
})();
