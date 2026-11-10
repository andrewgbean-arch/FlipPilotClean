// Run with: npx tsx market-backend/checks/bulkListingFilter.modelAndPlurals.check.ts (from the backend folder).
// Two things found on 10 Nov 2026 from real scans on the owner's phone, both with the real titles Google Shopping returned:
//  1. Plural accessory words. "Sony WH-1000XM4 Headphones Skins Matrix Black" got through because NOT_THE_ITEM only had the singular "skin": eleven identical
//     £25 skins were the biggest cluster of the 40 shop results, the real £130 and £205 headphones were thrown away as outliers, and the price came out at £44.50
//     against 38 eBay listings averaging £92.
//  2. namesAModel: whether a title names a specific model ("Duotts C29") or only a kind of thing ("Pine chest of drawers"); it decides whether an AI that says it
//     does not know the item may be set aside (see decidePrices in priceModel.ts).
import { isNotTheItem, namesAModel } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// ---- plural accessory words ----
const XM4 = "Sony WH-1000XM4";
for (const t of [
  "Sony WH-1000XM4 Headphones Skins Matrix Black",
  "Sony WH-1000XM4 Headphones Skins Black Carbon Fibre",
  "Sony WH-1000XM4 Headphones Skins Navy Blue 3D Honeycomb",
  "Sony WH1000XM4 Skins, Wraps & Covers » Capes Full Body / Carbon Fibre Black",
  "WC SweatZ XM4 Patented Protective Earpad Sweat Covers for Sony WH1000XM4 by WC",
]) eq(`dropped as an accessory: ${t.slice(0, 60)}`, isNotTheItem(t, XM4), true);
eq("covers on their own", isNotTheItem("Sony WH-1000XM4 Protective Earcup Covers Black", XM4), true);
eq("decals", isNotTheItem("invisiFRAME Trek Marlin 7 2025 Decals", "Trek Marlin 7"), true);
eq("stickers", isNotTheItem("Nike Air Max 90 Sticker Pack Stickers", "Nike Air Max 90"), true);

// The real thing is kept.
for (const t of [
  "Sony WH-1000XM4 Wireless Premium Noise Canceling Overhead Headphones",
  "Sony WH-1000XM4 Wireless Noise-Canceling Headphones (Silver)",
]) eq(`kept: ${t.slice(0, 60)}`, isNotTheItem(t, XM4), false);

// Whole consoles sold "with cables" must stay: the plural of "cable" is deliberately NOT in the list (two real Xbox Series S listings would have been lost).
eq("a console sold with cables is kept (1)", isNotTheItem("Xbox Series S 512gb Digital Console (white) Used - Cables And", "Xbox Series S"), false);
eq("a console sold with cables is kept (2)", isNotTheItem("Xbox Series S 512GB - Boxed W/ Controller & Cables Xbox Series S White", "Xbox Series S"), false);
eq("chargers and adapters are not in the list either", isNotTheItem("Nespresso Vertuo Next with Chargers and Adapters", "Nespresso Vertuo Next"), false);

// A word the search itself contains lets the plural through, in the singular or the plural.
eq("the search says skins", isNotTheItem("Sony WH-1000XM4 Headphones Skins Matrix Black", "Sony WH-1000XM4 skins"), false);
eq("the search says skin (singular)", isNotTheItem("Sony WH-1000XM4 Headphones Skins Matrix Black", "Sony WH-1000XM4 skin"), false);
eq("the search says cover, the listing says covers", isNotTheItem("Laptop Covers Pack", "Laptop cover"), false);
eq("the search says decals", isNotTheItem("Trek Marlin 7 2025 Decals", "Trek Marlin 7 decals"), false);

// Whole words only.
eq("'discovers' is not 'covers'", isNotTheItem("Sony WH-1000XM4 Headphones, Discovers Bass", XM4), false);
eq("'skinsuit' is not 'skins'", isNotTheItem("Speedo Skinsuit Triathlon", "Speedo Triathlon"), false);

// The singular rule it sits beside is untouched.
eq("a hard case is still an accessory", isNotTheItem("RIYADAone Hard Case Compatible Sony WH-1000XM4 Headphones", XM4), true);
eq("a skin (singular) is still an accessory", isNotTheItem("Sony WH-1000XM4 Skin Black", XM4), true);

// ---- namesAModel ----
for (const t of ["Duotts C29", "Sony WH-1000XM4", "Fafrees F20", "Navee N65", "Levi's 501 jeans", "Doc Martens 1460", "Lego Star Wars Millennium Falcon 75257",
  "Samsung Galaxy S21", "Canon EOS 250D", "Brompton M6L", "DeWalt DCD771 drill", "Makita DHP482", "Karcher K4 pressure washer", "Ninja AF100 air fryer",
  "Dyson V8 Absolute", "Duotts C29 electric bike 750W"]) {
  eq(`names a model: ${t}`, namesAModel(t), true);
}
for (const t of ["Pine chest of drawers", "Oak coffee table", "Russell Hobbs toaster", "Hot Wheels track set", "Apollo Jewel", "Electric Mountain Bike", "Oak coffee table 120cm",
  "Electric bike 750W 48V 15Ah", "Large 5 drawer chest", "4K smart TV", "iPhone 12 64GB", "Giant Escape 3", "Instant Pot Duo 6 litre", "Nerf Elite 2.0 blaster",
  "Mountain bike 2024", "Samsung TV 55 inch", "Sofa 3 seater", "Barbie Dreamhouse", "5G phone 128GB", "Kettle 1.7L", "Nintendo Switch OLED"]) {
  eq(`names no model: ${t}`, namesAModel(t), false);
}
// A model written as letters and a rating ("GSR 18V-55") is missed: that only means the AI keeps its say there, as before. The rule errs on the side of leaving prices alone.
eq("Bosch GSR 18V-55: missed on purpose (the rule is conservative)", namesAModel("Bosch GSR 18V-55"), false);
eq("nothing: no model", namesAModel(""), false);
eq("null: no model", namesAModel(null), false);
eq("undefined: no model", namesAModel(undefined), false);
eq("a bare three-digit number is a model", namesAModel("Nike Air Max 270"), true);
eq("a year is not a model", namesAModel("Ford Focus 2019"), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
