// Run with: npx tsx market-backend/checks/aiPricePrompt.check.ts (from the backend folder).
// Pins down what the AI price helper is asked, so the second-hand guidance (added 20 Oct 2026 after the AI's used prices were
// measured at 1.5-1.7x the real eBay listings) cannot be dropped or reworded away unnoticed.
import { aiPricePrompt } from "../fetchMarketData";

let fail = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) {
    fail++;
    console.log("FAIL", label);
  }
};

const p = aiPricePrompt("Samsung Galaxy S21 Smartphone 128GB");
ok("names the item", p.includes('Item: "Samsung Galaxy S21 Smartphone 128GB"'));
ok("no pack line without a pack size", !p.includes("Pack size:") && !p.includes("(this pack size)"));
ok("tells the AI to think about the second-hand market, not launch prices", /SECOND-HAND market/.test(p) && /not launch prices/.test(p));
ok("says gadgets, clothes and furniture lose value fast", /lose value fast/.test(p) && /gadgets/.test(p) && /furniture/.test(p));
ok("asks for what it sells for, not hopeful asking prices", /sold prices, not hopeful asking prices/.test(p));
ok("still asks for the four fields as JSON", ["newPrice", "usedMin", "usedMax", "confidence"].every((k) => p.includes(`"${k}"`)) && p.includes("Return ONLY valid JSON"));
ok("keeps the rule about specific models", /Never substitute a cheaper, better-known model/.test(p));

const pack = aiPricePrompt("Walkers Crisps 6 pack", 6);
ok("states the pack size when there is one", pack.includes("Pack size: 6 in the pack") && pack.includes("(this pack size)"));

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
