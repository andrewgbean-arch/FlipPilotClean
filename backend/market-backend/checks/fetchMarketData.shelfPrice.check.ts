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

// The real 40 Google Shopping results for "Sony WH-1000XM4" on 10 Nov 2026 (title and price only): thirteen of them are skins and covers, eleven of those an identical £25.
const XM4_SHOP = [
  { title: "Sony WF-1000XM4 Wireless Noise Cancelling Headphones", extracted_price: 67.36 },
  { title: "Sony Wf-1000xm4 True Wireless Bluetooth In-ear Earbuds Built-in Mic", extracted_price: 46.69 },
  { title: "Sony WF-1000XM4 Wireless Noise Cancelling Headphones", extracted_price: 92.22 },
  { title: "Sony WF-1000XM4 Wireless Noise Cancelling Headphones", extracted_price: 95.71 },
  { title: "The American Pie Swim Dress", extracted_price: 129.99 },
  { title: "Sony WH-1000XM5 Noise Cancelling Wireless Headphones", extracted_price: 106.45 },
  { title: "Sony WH-1000XM4 Wireless Premium Noise Canceling Overhead Headphones", extracted_price: 130.7 },
  { title: "Sony WH-1000XM6 Wireless Noise-Cancelling Headphones", extracted_price: 339 },
  { title: "Sony WH-1000XM6 Wireless Noise-Cancelling Headphones", extracted_price: 397.09 },
  { title: "Sony WH-1000XM4 Wireless Noise-Canceling Headphones (Silver)", extracted_price: 204.59 },
  { title: "Sony WH-1000XM3 Wireless Noise Cancelling Headphones", extracted_price: 262 },
  { title: "Sony WH-1000XM4 Battery 1000mAh from CELLONIC", extracted_price: 16.1 },
  { title: "CentralSound Replacement Headband Cushion Pad, Compatible With Sony WH-1000XM4 WH1000XM4 XM4 Headphones, Black, Protein Leather And Memory Foam", extracted_price: 16 },
  { title: "Sony WH-1000XM4 Comfort Suspension Strap Blue", extracted_price: 17 },
  { title: "Sony WH1000XM4 Skins, Wraps & Covers » Capes Full Body / Carbon Fibre Black", extracted_price: 12.66 },
  { title: "Sony Wh-1000xm4 Empty Box, Box Only", extracted_price: 14.99 },
  { title: "Sony Wh-1000xm4 Genuine Carry Case / Pouch", extracted_price: 24.99 },
  { title: "Sony Wh-1000xm4 Speaker Driver", extracted_price: 24.99 },
  { title: "RIYADAone Hard Case Compatible Sony WH-1000XM4 / XM5 / XM6 / XM3 Headphones | EVA Nylon hard case, splash-proof, dust-proof, easy to carry, traveling,", extracted_price: 16.99 },
  { title: "Sony WH-1000XM4 Comfort Suspension Strap White", extracted_price: 17 },
  { title: "Sony WH-1000XM4 Comfort Suspension Strap Black", extracted_price: 16 },
  { title: "Sony WH-1000XM4 Headphones Skins Matrix Black", extracted_price: 25 },
  { title: "Sony WH1000XM4 Skins, Wraps & Covers » Capes Full Body / Tornado", extracted_price: 12.66 },
  { title: "WC SweatZ XM4 Patented Protective Earpad Sweat Covers for Sony WH1000XM4 by WC", extracted_price: 21.95 },
  { title: "Sony WH-1000XM4 Headphones Skins Black Carbon Fibre", extracted_price: 25 },
  { title: "A94 Sony Wf-1000xm4 Kingdom Hearts 20th Anniversary Model", extracted_price: 218.11 },
  { title: "Sony WH-1000XM4 Comfort Suspension Strap Gray", extracted_price: 17 },
  { title: "Sony WH-1000XM4 Headphones Skins Dark-oak", extracted_price: 25 },
  { title: "Sony WH1000XM4 Skins, Wraps & Covers » Capes Full Body / Lava", extracted_price: 12.66 },
  { title: "Sony WH-1000XM4 Battery", extracted_price: 16.59 },
  { title: "Sony WH-1000XM4 Comfort Suspension Strap Tan", extracted_price: 16 },
  { title: "Sony WH-1000XM4 Headphones Skins White-carbon-fibre", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headphones Skins Iced-blue", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headphones Skins Navy Blue 3D Honeycomb", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headphones Skins Iced Red", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headphones Skins Iced-green", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headband Replacement Service", extracted_price: 50 },
  { title: "Ear Pads Replacement for WH-1000XM4 Headphones Soft Memory Foam Pads Ear8672. SODIAL", extracted_price: 7.48 },
  { title: "Sony WH-1000XM4 Headphones Skins Forged Carbon Fibre", extracted_price: 25 },
  { title: "Sony WH-1000XM4 Headphones Skins Cosmic Morpheus Gloss", extracted_price: 25 },
];

// The real 40 Google Shopping results for "Apple AirPods Pro 2nd generation" on 10 Nov 2026 (title and price only): of the six that survived the old filtering, five were a lone left or right earbud.
const AIRPODS_SHOP = [
  { title: "Apple Airpods 2nd Gen A2032 Right Earbud Only Genuine Apple", extracted_price: 16.38 },
  { title: "Genuine Apple Airpods 2nd Generation Right Side Only A2032", extracted_price: 56.49 },
  { title: "Genuine Apple Airpods 2nd Gen A2032 Right Side Earbud Only,", extracted_price: 18.79 },
  { title: "Apple Airpod 2nd Generation 100% Genuine Left Side Only With Charging", extracted_price: 44.99 },
  { title: "Apple Airpods 2nd Generation 100% Genuine Bluetooth - Left Side Only", extracted_price: 31.66 },
  { title: "Apple Airpods 2nd Generation Right Airpod Only - Model: A3202", extracted_price: 29.3 },
  { title: "Apple Airpods Right Side 2nd Generation Replacement Bluetooth Earphone", extracted_price: 29.99 },
  { title: "Apple AirPods Pro 2nd Generation replacement charging case", extracted_price: 59.99 },
  { title: "Apple Airpods 2nd Generation White With Only Left Headphone Original", extracted_price: 25.41 },
  { title: "Apple Airpods 2nd Gen - Right Earbud And Charging Case Only - No Left", extracted_price: 30 },
  { title: "Apple AirPods Max 2", extracted_price: 499 },
  { title: "Apple AirPods Max 2", extracted_price: 499 },
  { title: "Apple AirPods Max 2", extracted_price: 499 },
  { title: "Apple AirPods Pro 2nd Generation with MagSafe Charging Case", extracted_price: 200.39 },
  { title: "Apple AirPods Pro 3", extracted_price: 130.7 },
  { title: "Apple AirPods with Charging Case", extracted_price: 95 },
  { title: "Apple AirPods Pro with MagSafe Charging Case", extracted_price: 167.09 },
  { title: "Apple AirPods Pro 3", extracted_price: 133 },
  { title: "For Apple Airpods Pro 2nd Gen Right Earbud A2698 -only For Lightning", extracted_price: 43.99 },
  { title: "For AirPods Pro 2nd Wireless Earbuds, ANC,Bluetooth Headphones, Active Noise Cancellation with Charging Case-Not Apple Brand Headphones", extracted_price: 18.99 },
  { title: "Apple AirPods 2 with Wireless Charging Case White", extracted_price: 78.7 },
  { title: "Apple Airpods Pro 2nd Generation Left Side A3048 Year 2023 Single", extracted_price: 59.99 },
  { title: "Apple AirPods Pro With Charging Case", extracted_price: 4 },
  { title: "Apple Airpods Pro 2nd Gen Left Side Replacement A2698 Year 2022", extracted_price: 49.99 },
  { title: "Apple AirPod Pro", extracted_price: 115.1 },
  { title: "Airpods Pro", extracted_price: 73.5 },
  { title: "Brand New Apple AirPods Pro – Still Sealed in Box", extracted_price: 39.99 },
  { title: "Apple Airpods 2nd Generation", extracted_price: 187.89 },
  { title: "Apple Airpods Pro", extracted_price: 40.18 },
  { title: "Apple Airpods 2nd Generation Brand In The Box Everything Included", extracted_price: 130.7 },
  { title: "Genuine Apple Airpods Pro 2nd Gen Replacement Right Only A2698", extracted_price: 36.99 },
  { title: "Airpods Pro", extracted_price: 26.7 },
  { title: "Apple Airpods Pro 2nd Gen Left Side Replacement A2698 Year 2022", extracted_price: 49.99 },
  { title: "Apple Airpods White", extracted_price: 69 },
  { title: "Apple AirPods Pro - Brand New, Sealed Box", extracted_price: 50 },
  { title: "Apple Airpods Pro 2nd Generation Replacement Left Only Lightning A2699", extracted_price: 40.99 },
  { title: "Apple Airpods Pro In-Ear Headphones (With Wireless Charging Case) A2083+A2084 White", extracted_price: 79.99 },
  { title: "Apple AirPods Pro with Wireless Charging Case - White", extracted_price: 59 },
  { title: "Apple Airpods 2nd Generation White", extracted_price: 52.7 },
  { title: "Apple Airpods 2nd Generation White", extracted_price: 115.1 },
];

(async () => {
  for (const k of ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "CLIENT_ID", "CLIENT_SECRET", "API_KEY"]) delete process.env[k];
  process.env.OPENAI_API_KEY = "test-key";
  process.env.SERPAPI_KEY = "test-key";
  process.env.GOOGLE_SHOPPING = "always";

  (axios as any).get = async (url: string) => {
    if (String(url).includes("Duotts")) return { data: { shopping_results: DUOTTS_SHOP } };
    if (String(url).includes("WH-1000XM4")) return { data: { shopping_results: XM4_SHOP } };
    if (String(url).includes("AirPods%20Pro")) return { data: { shopping_results: AIRPODS_SHOP } };
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

  // With the AI that does not know the brand set aside (11 shop listings, a model named), a used one is worked from the shop price, not from the AI's £50.
  eq("duotts: the price is about £383, not £213", duotts.average, 383);
  eq("duotts: buy is half", duotts.smartPrice, 191.5);

  eq("duotts: the title names a model", (duotts as any).priceInputs?.namedModel, true);
  eq("duotts: the AI said it does not know it", (duotts as any).priceInputs?.aiRecognised, false);
  eq("duotts: 11 shop listings stand behind the price", (duotts as any).priceInputs?.googleListings, 11);
  const generic = await fetchMarketData("Oak coffee table", { condition: "used" });
  eq("a generic title names no model", (generic as any).priceInputs?.namedModel, false);

  // The skins no longer outvote the headphones: 40 results, the skins and covers dropped, the real and near ones left.
  const xm4 = await fetchMarketData("Sony WH-1000XM4", { condition: "used" });
  eq("xm4: five listings survive, not the eleven skins", xm4.googleCount, 5);
  eq("xm4: the cheapest is no longer a skin at £24.99", xm4.googlePriceMin, 46.69);
  eq("xm4: the dearest is the real headphones at £130.70", xm4.googlePriceMax, 130.7);
  eq("xm4: the typical price is £95.71, not £25", xm4.googleShelfPrice, 95.71);

  // A lone earbud is a part, not the pair: of the 40 results the single left or right earbuds go, and the pairs stay.
  const airpods = await fetchMarketData("Apple AirPods Pro 2nd generation", { condition: "used" });
  eq("airpods: four listings survive, not six (two of the old six were a pair)", airpods.googleCount, 4);
  eq("airpods: the cheapest is no longer a £25 single earbud", airpods.googlePriceMin, 52.7);
  eq("airpods: the typical price is £187.89, not £56.49", airpods.googleShelfPrice, 187.89);

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
