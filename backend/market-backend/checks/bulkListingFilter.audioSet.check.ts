// Run with: npx tsx market-backend/checks/bulkListingFilter.audioSet.check.ts (from the backend folder).
// Earbuds and headphones are sold WITH a case, and the accessory words ("case", "charging") dropped the pair. Found 10 Nov 2026 on live eBay used listings: of 41 matching AirPods 2nd generation
// listings only 4 were kept, of 43 AirPods 3rd generation 9, of 50 Sony WF-1000XM4 12; 17 of the dropped Sony ones mentioned only a case, charging or a cable. The titles below are real ones. Over 16
// earbud and headphone searches (782 used listings) the rule newly kept 92 listings (AirPods 2nd generation: 3 survivors -> 19, middle asking price £83 -> £32, which is what a used pair
// sells for) and dropped none of its own.
import { isAudioSetWithCase, isNotTheItem } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// [search, title]: the whole pair (or headphones) sold with its case: kept.
const PAIRS: [string, string][] = [
  ["Apple AirPods Pro 2nd generation", "Apple AirPods Pro 2nd Generation with MagSafe Wireless Charging Case - White"],
  ["Apple AirPods Pro 2nd generation", "Genuine Apple AirPods Pro 2nd Generation (USB-C) with Charging Case MTJV3ZM/A"],
  ["Apple AirPods 3rd generation", "Apple AirPods 3rd Generation With Case"],
  ["Apple AirPods 3rd generation", "Apple AirPods 3rd Generation White Bluetooth Wireless In-Ear Earbuds + Case"],
  ["Apple AirPods 2nd generation", "Apple AirPods 2nd Generation with Lightning Charging Case - White"],
  ["Apple AirPods 2nd generation", "Apple AirPods 2nd Generation Wireless Earphones with Charging Case and Box"],
  ["Jabra Elite 75t", "Jabra Elite Active 75t In-Ear True Wireless Earbuds Earphones W Charging Case"],
  ["Sony WF-1000XM4", "Sony WF-1000XM4 Noise Cancelling Wireless Earbuds Black & Charging Case Working"],
  ["Sony WF-1000XM4", "Sony WF-1000XM4 Black Bluetooth True Wireless In-Ear Earbuds w/Case Mic"],
  ["Sony WF-1000XM4", "Sony WF-1000XM4 Bluetooth In-Ear Earbuds, ANC, Mic, Black + Case"],
  ["Sony WF-1000XM4", "Sony WF-1000XM4 Wireless Bluetooth Earbuds Earphones W Charging Case Beige"],
  ["Sony WH-1000XM4", "Sony WH-1000XM4 Bluetooth Wireless Over-Ear Headphones With Case - Blue"],
  ["Samsung Galaxy Buds2", "Samsung Galaxy Buds2 Pro True Wireless Bluetooth In-Ear Earbuds w/ Case Black"],
  ["Bose QuietComfort Earbuds", "Bose Quiet comfort ultra 2nd gen In-Ear Bluetooth Earbuds with Charging Case"],
  ["Sennheiser Momentum True Wireless 2", "SENNHEISER MOMENTUM TRUE WIRELESS 2 IN-EAR HEADPHONES WITH CHARGING CASE AND BOX"],
];
for (const [q, t] of PAIRS) {
  eq(`a pair with its case is the item: ${t.slice(0, 70)}`, isNotTheItem(t, q), false);
  eq(`...recognised as an audio set: ${t.slice(0, 60)}`, isAudioSetWithCase(t), true);
}

// [search, title]: the case on its own, or a cradle, or a replacement: still not the item.
const CASES: [string, string][] = [
  ["Apple AirPods Pro 2nd generation", "Genuine Original Apple AirPods Pro 2nd Generation A2700 – Charging Case ONLY"],
  ["Apple AirPods Pro 2nd generation", "Genuine Original Apple AirPods Pro 2nd Generation A2968 Charging Case - USB C"],
  ["Apple AirPods Pro 2nd generation", "Replacement Charging Case for Apple AirPods Pro with Wireless Charging Case"],
  ["Apple AirPods 3rd generation", "Genuine Original Apple AirPods 3rd Generation Charging Case ONLY"],
  ["Apple AirPods 3rd generation", "Apple AirPod 3rd Generation Charging Case A2566"],
  ["Beats Studio Buds", "Beats Studio Buds Case Only & Working"],
  ["Samsung Galaxy Buds2", "(CASE ONLY) Genuine Samsung Galaxy Buds2 SM-R177 Charging Case - Graphite Black"],
  ["Bose QuietComfort Earbuds", "Genuine Bose QuietComfort Earbuds Charging Case Cradle 429708 Tested Working"],
  ["Bose QuietComfort Earbuds", "Bose 429708 Genuine Charging Case for Bose QuietComfort Earbuds | Case Only"],
  ["Jabra Elite 75t", "Genuine Jabra Elite 75t WIRELESS charging case ONLY ,CPB125 BLACK VGC"],
  ["Sony WF-1000XM4", "Sony WF-1000XM4 Charging Case Cradle Black A5036917A Tested Working"],
  ["Sony WF-1000XM4", "Sony Wf-1000xm4 Case  Only & Working"],
];
for (const [q, t] of CASES) eq(`a case on its own is not the item: ${t.slice(0, 70)}`, isNotTheItem(t, q), true);

// The pair rules still apply on top: one earbud with its case is not the pair, and other accessory words are still held against the listing.
eq("one earbud and its case, no 'only'", isNotTheItem("Apple AirPods 2nd Generation Left Earbud & Charging Case", "Apple AirPods 2nd generation"), true);
eq("one earbud and its case, 'only' at the end", isNotTheItem("Apple Airpods 2nd Gen - Right Earbud And Charging Case Only - No Left", "Apple AirPods 2nd generation"), true);
eq("a replacement part with the pair is still a part", isNotTheItem("Apple AirPods Pro with Charging Case and Replacement Ear Tips", "Apple AirPods Pro"), true);
eq("only the words case and charging are forgiven (a cable is not)", isNotTheItem("Apple AirPods Pro with Charging Case and USB Cable", "Apple AirPods Pro"), true);
eq("a battery is not forgiven", isNotTheItem("Sony WF-1000XM4 Earbuds with Case and Battery", "Sony WF-1000XM4"), true);
eq("faulty is not forgiven", isNotTheItem("Apple AirPods Pro 2nd Generation with Charging Case - FAULTY", "Apple AirPods Pro 2nd generation"), true);

// Nothing changes for what is not an earbud or a pair of headphones.
eq("a console sold with a case is judged as before", isNotTheItem("Nintendo Switch OLED with Case", "Nintendo Switch OLED"), true);
eq("a tablet with a case is judged as before", isNotTheItem("Apple iPad Air 2020 64GB with Case", "Apple iPad Air 2020"), true);
eq("a camera with a charger is judged as before", isNotTheItem("Canon EOS 250D with Charger", "Canon EOS 250D"), true);
eq("the audio check alone: a console", isAudioSetWithCase("Nintendo Switch OLED with Case"), false);
eq("the audio check alone: a case with no earbuds named", isAudioSetWithCase("Sony WF-1000XM4 with Charging Case"), false);
eq("the audio check alone: an earbud with no case", isAudioSetWithCase("Apple AirPods Pro 2nd Generation White"), false);
eq("the audio check alone: nothing", isAudioSetWithCase(""), false);
eq("the audio check alone: null", isAudioSetWithCase(null), false);

// A search that itself asks for the case is unchanged (nothing is held against a word the search has).
eq("a search for the case", isNotTheItem("Apple AirPods Pro 2nd Generation Charging Case ONLY", "Apple AirPods Pro charging case only"), false);

// Each of the words that say the listing is the case on its own is decisive by itself: with the connector present and no other accessory word, only that word keeps the listing out.
eq("'only' alone", isNotTheItem("Apple AirPods Pro 2nd Generation with Charging Case Only", "Apple AirPods Pro 2nd generation"), true);
eq("'cradle' alone", isNotTheItem("Sony WF-1000XM4 Earbuds with Charging Case Cradle", "Sony WF-1000XM4"), true);
eq("'empty' alone", isNotTheItem("Apple AirPods Pro 2nd Generation with Empty Charging Case", "Apple AirPods Pro 2nd generation"), true);
eq("...and without any of them the same title is a pair", isNotTheItem("Sony WF-1000XM4 Earbuds with Charging Case Black", "Sony WF-1000XM4"), false);
// What the other rules already hold against a listing (a replacement, a spare, something made for the earbuds) needs no help from this one.
eq("a replacement with the pair stays out", isNotTheItem("Sony WF-1000XM4 Earbuds with Replacement Charging Case", "Sony WF-1000XM4"), true);
eq("made for the earbuds stays out", isNotTheItem("Charging Case Cover Made for Sony WF-1000XM4 Earbuds with Case", "Sony WF-1000XM4"), true);

// A "+" stuck to a name is part of the name ("Beats Studio Buds+"), not "plus a case": that title is a case on its own (found among the newly kept listings of the first version).
eq("'Buds+ - Charging Case' is not a pair with a case", isNotTheItem("Transparent Beats Studio Buds+ - Charging Case", "Beats Studio Buds"), true);
eq("...nor is it recognised as an audio set", isAudioSetWithCase("Transparent Beats Studio Buds+ - Charging Case"), false);
eq("a standalone plus is a connector", isAudioSetWithCase("Beats Studio Buds + Charging Case"), true);
eq("a standalone ampersand is a connector", isAudioSetWithCase("Beats Studio Buds & Charging Case"), true);

// "without" is not "with", and a "with" a long way from "case" is not read as one.
eq("without a case is not with a case", isAudioSetWithCase("Apple AirPods Pro 2nd Generation WITHOUT Charging Case"), false);
eq("...and is still judged as before (the case word drops it)", isNotTheItem("Apple AirPods Pro 2nd Generation WITHOUT Charging Case", "Apple AirPods Pro 2nd generation"), true);
eq("'with' and 'case' more than three words apart", isAudioSetWithCase("Apple AirPods Pro with free UK postage and charging case"), false);
eq("'with' and 'case' three words apart", isAudioSetWithCase("Apple AirPods Pro with MagSafe Wireless Charging Case"), true);

// "w" is the word, not a letter inside a number or a unit: "5W Charging Case" is not "with Charging Case".
eq("5W is not 'w'", isAudioSetWithCase("Anker 5W Earbuds Charging Case"), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
