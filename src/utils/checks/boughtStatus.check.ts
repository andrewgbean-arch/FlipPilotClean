// Run with: npx tsx src/utils/checks/boughtStatus.check.ts (from the app root).
// Found 2026-10-14 (owner): the Home "Total profit" added up the estimated profit of EVERY saved scan, as if
// everything scanned had been bought. Saving a scan only records what it is worth; only items the person
// confirms buying, and what they paid, should count.
import type { FlipRecord } from "../../features/vehicles/models/FlipRecord";
import {
  MAX_PAID_PRICE,
  bestBoughtFlip,
  boughtPatch,
  boughtState,
  notBoughtPatch,
  parsePaidPrice,
  profitSummary,
} from "../../features/vehicles/utils/boughtStatus";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

const flip = (p: Partial<FlipRecord>): FlipRecord => ({ id: "x", title: "Thing", buyPrice: null, sellPrice: null, timestamp: "2026-10-14T10:00:00Z", ...p });

// ---- the three states -------------------------------------------------------------------------
eq("confirmed bought", boughtState(flip({ bought: true })), "bought");
eq("confirmed not bought", boughtState(flip({ bought: false })), "not-bought");
eq("a scan saved before the question existed has not been answered", boughtState(flip({ buyPrice: 5, sellPrice: 15, profit: 10 })), "unconfirmed");
eq("a scan saved with null is unanswered too", boughtState(flip({ bought: null })), "unconfirmed");
eq("a vehicle entered in Motors (it has an MOT record) can only have been bought", boughtState(flip({ mot: { reg: "AB12 CDE" } })), "bought");
eq("an item already marked sold can only have been bought", boughtState(flip({ sellDate: "2026-10-01T00:00:00Z" })), "bought");
eq("...but if they said they did NOT buy it, that wins over a vehicle record", boughtState(flip({ bought: false, mot: { reg: "AB12 CDE" } })), "not-bought");

// ---- the total only counts what was bought ----------------------------------------------------
const saved = [
  flip({ id: "scan-unanswered", buyPrice: 10, sellPrice: 20, profit: 10 }), // saved, never answered: NOT counted
  flip({ id: "scan-bought", bought: true, buyPrice: 12, sellPrice: 20, profit: 8 }), // counted
  flip({ id: "scan-declined", bought: false, buyPrice: 1, sellPrice: 101, profit: 100 }), // NOT counted
  flip({ id: "vehicle", mot: { reg: "AB12 CDE" }, buyPrice: 1000, sellPrice: 1500, profit: 500 }), // counted
  flip({ id: "scan-sold", sellDate: "2026-10-02T00:00:00Z", buyPrice: 3, sellPrice: 10, profit: 7 }), // counted
];
const s = profitSummary(saved);
eq("total is only the bought items' profit (8 + 500 + 7)", s.total, 515);
eq("three were bought", s.bought, 3);
eq("one is still to answer", s.unconfirmed, 1);
eq("one was declined", s.notBought, 1);
eq("no items: nothing, not NaN", profitSummary([]), { total: 0, bought: 0, unconfirmed: 0, notBought: 0 });
eq("nothing answered yet: the total is zero, whatever the estimates say", profitSummary([flip({ buyPrice: 5, sellPrice: 50, profit: 45 }), flip({ buyPrice: 1, sellPrice: 9, profit: 8 })]).total, 0);
eq("a bought item with no profit figure adds nothing, and breaks nothing", profitSummary([flip({ bought: true, buyPrice: 10 })]).total, 0);
eq("a loss on a bought item reduces the total", profitSummary([flip({ bought: true, buyPrice: 30, sellPrice: 20, profit: -10 }), flip({ bought: true, buyPrice: 5, sellPrice: 25, profit: 20 })]).total, 10);

// A record with no prices of its own falls back to the scan's original estimate, the same way every screen reads it.
eq("an older bought record that only has the scan's estimate uses that estimate", profitSummary([flip({ bought: true, pricing: { predictedProfit: 12 } })]).total, 12);
eq("...and the same record is not counted until it is bought", profitSummary([flip({ pricing: { predictedProfit: 12 } })]).total, 0);

// ---- best flip is a bought one ----------------------------------------------------------------
eq("best flip ignores an unbought item with a bigger estimate", bestBoughtFlip(saved)?.id, "vehicle");
eq("no bought item: no best flip", bestBoughtFlip([flip({ buyPrice: 5, sellPrice: 50, profit: 45 })]), null);
eq("a bought item with no profit figure is not a best flip", bestBoughtFlip([flip({ bought: true })]), null);

// ---- what they typed as the price paid --------------------------------------------------------
eq("plain pounds", parsePaidPrice("12"), 12);
eq("pence", parsePaidPrice("12.50"), 12.5);
eq("with a pound sign", parsePaidPrice("£12.50"), 12.5);
eq("with spaces", parsePaidPrice("  £ 7 "), 7);
eq("free is a valid price", parsePaidPrice("0"), 0);
eq("a thousands comma", parsePaidPrice("1,250"), 1250);
eq("a thousands comma with pence", parsePaidPrice("1,250.50"), 1250.5);
eq("a decimal comma is 12.50, never 1,250", parsePaidPrice("12,50"), 12.5);
eq("rounds to the penny", parsePaidPrice("10.999"), 11);
eq("empty", parsePaidPrice(""), null);
eq("only spaces", parsePaidPrice("   "), null);
eq("words", parsePaidPrice("abc"), null);
eq("negative", parsePaidPrice("-5"), null);
eq("two dots", parsePaidPrice("12.5.3"), null);
eq("scientific notation", parsePaidPrice("1e3"), null);
eq("a trailing dot is not a number", parsePaidPrice("12."), null);
eq("a typing slip far too large", parsePaidPrice("99999999"), null);
eq("the largest allowed", parsePaidPrice(String(MAX_PAID_PRICE)), MAX_PAID_PRICE);
eq("null", parsePaidPrice(null), null);
eq("undefined", parsePaidPrice(undefined), null);

// ---- the changes saved ------------------------------------------------------------------------
const when = new Date("2026-10-14T09:30:00Z");
eq("confirming records bought, what was paid, and when", boughtPatch(12.5, when), { bought: true, buyPrice: 12.5, buyDate: "2026-10-14T09:30:00.000Z" });
eq("the paid price is held to the penny", boughtPatch(12.499, when).buyPrice, 12.5);
eq("declining records only that", notBoughtPatch(), { bought: false });

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
