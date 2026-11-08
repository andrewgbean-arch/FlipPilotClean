// Run with: npx tsx market-backend/checks/bulkListingFilter.ebikes.check.ts (from the backend folder).
// Found live 2026-11-08 on a typed "Duotts C29" (an e-bike): all three of its eBay UK listings were thrown out by isNotTheItem for saying "Battery" and "Motor",
// which an electric bike's own title names, so it looked as if eBay had nothing. And the one thing that did come back for "Duotts C29 electric bike" was a
// child seat made FOR it. Two fixes, both pinned here with the real titles: a title that is plainly a WHOLE electric bike is not held to its own battery and
// motor, and a title that says it is FOR the searched item (or "fits"/"to fit" it) is an accessory.
import { isNotTheItem } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};
const keeps = (label: string, title: string, query: string) => eq(`keeps: ${label}`, isNotTheItem(title, query), false);
const drops = (label: string, title: string, query: string) => eq(`drops: ${label}`, isNotTheItem(title, query), true);

// ---- a whole electric bike names its battery and motor ----
keeps("Duotts C29, rear motor", "DUOTTS C29  Bike,48V15Ah Battery,750 Motor E Mountain Bike 33MPH 29” REAR MOTOR", "Duotts C29");
keeps("Duotts C29, double battery", "DUOTTS C29  Bike,48V15Ah+15AH  Battery,750 Motor E Mountain Bike 33MPH 29”DOUBLE", "Duotts C29");
keeps("Fafrees, removable battery", "FAFREES F26 PRO 26inch Electric Bicycle mountain Bike 16AH Removable Battery", "Fafrees F26 Pro");
keeps("a city e-bike with its battery in the title", "26\" Electric Bike 250W 36V 16Ah Battery | UK Legal City Commuter E‑Bike | 25km/h", "Fafrees F26 Pro");
keeps("an electric scooter with battery and motor", "Xiaomi Mi Electric Scooter M365 Adult Folding 25km/h 350W Motor Battery", "Xiaomi M365 scooter");

// ---- but a part, a kit or a charger is still not the bike ----
drops("the battery-only option of the same listing", "DUOTTS C29  Bike,48V15Ah Battery,750 Motor E Mountain Bike 33MPH 29” ONLY BATT", "Duotts C29");
drops("a charger for the bike", "3 Amps Charger for Jasion EB5 Plus Electric Bike", "Jasion EB5");
drops("a smart charger for the bike", "Smart Charger for Ecotric Vortex Electric City Bike 26-inch eBike", "Ecotric Vortex");
drops("a battery for an electric mountain bike", "48V 15Ah Battery for Electric Mountain Bike 26 inch", "electric mountain bike");
drops("a conversion kit", "Electric Bike Conversion Kit 36V 250W Motor Hub Wheel", "electric bike");
drops("a charger on its own", "E-bike Battery Charger 36V 2A", "electric bike");
drops("a battery that is not for a bike at all", "Dyson V8 Battery Replacement 21.6V", "Dyson V8");

// ---- a title that is FOR the item searched is something that goes with it ----
drops("a child seat made for the Duotts", "Rear Child Seat Kids Seat For DUOTTS C29 Electric Bike E-bike New 2026 Safety", "Duotts C29");
drops("brake pads 'to fit' a Marlin", "2 Sets Brake Pads to fit Trek Marlin 7 Gen 3 Front & Rear UK Stock Ready to Ship", "Trek Marlin 7");
drops("a hanger that 'fits' a Marlin", "Rear Derailleur Mech Hanger GH-138 D185 CC019 Fits Trek Marlin 4 6 7 8 Series FX", "Trek Marlin 7");
drops("a controller for the PlayStation 5", "Sony DualSense Wireless Controller for PlayStation 5 Console - Red/Black", "PlayStation 5");
drops("a lens for the camera", "Canon EF fit 420-800mm lens for EOS camera  4000D 250d 90D 850D 750D  550D 2000D", "Canon EOS 250D");
drops("a brush head for the Dyson", "Brush Head for Dyson V7 V8 V10 V11 V15 Animal Torque Direct Drive Motorhead Tool", "Dyson V10");
drops("'for the' is skipped over", "Replacement Filter for the Dyson V8 Absolute", "Dyson V8 Absolute");

// ---- and it must not take real listings with it ----
keeps("'Straight Fit Jeans' is the jeans, not a 'fits'", "Levi's 501 Men's Straight Fit Jeans Blue Denim Button Fly New with tags", "Levi's 501 Jeans");
keeps("'New for 2024' is not 'for' the make", "NEW for 2024 Sony WH-1000XM4 Wireless Noise Cancelling Headphones", "Sony WH-1000XM4");
keeps("'great for travel' is not 'for' the make", "Sony WH-1000XM4 Wireless Headphones - Great for Travel", "Sony WH-1000XM4");
keeps("'for pet hair' is not 'for' the make", "Dyson V8 Absolute Cordless Vacuum Cleaner for Pet Hair", "Dyson V8 Absolute");
keeps("a plain listing", "Giant Escape 3 Hybrid Bike 2022 Size M Grey", "Giant Escape 3");

// ---- what was already caught still is ----
drops("a case, as before", "JBL Charge 4 Case Cover Travel Bag", "JBL Charge 4");
keeps("a word the search itself contains is still not held against a listing", "Anker 20W USB-C Phone Charger Fast PD", "phone charger");

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
