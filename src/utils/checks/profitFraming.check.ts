// Run with: npx tsx src/utils/checks/profitFraming.check.ts (from the app root).
// Found 2026-10-18 on the owner's phone: five photo scans in a row all showed "Estimated profit" equal to the
// buy price and "ROI +100.0%", because the buy price is the app's own suggestion (half the sell price), not
// something anyone paid. Until the person sets the buy price, the profit says "if you buy at £X", names the
// assumption, and shows no ROI.
import { profitFraming } from "../profitFraming";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// The app's own suggestion (what every fresh scan starts as): worded as a scenario, no ROI.
const e = profitFraming({ buy: 255, sell: 510, buyIsTheirs: false, sourceLabel: "Charity shop", sourceShare: 0.5 });
eq("suggested buy: heading is a scenario", e.heading, "Profit if you buy at £255.00");
eq("suggested buy: no ROI", e.showRoi, false);
eq("suggested buy: the note names the assumption", e.note, "Assumes a charity shop price (50% of the sell price). Tap Buy to enter what you'd really pay.");
eq("car boot wording", profitFraming({ buy: 3.5, sell: 10, buyIsTheirs: false, sourceLabel: "Car boot", sourceShare: 0.35 }).note, "Assumes a car boot price (35% of the sell price). Tap Buy to enter what you'd really pay.");
eq("shop/online wording", profitFraming({ buy: 6.5, sell: 10, buyIsTheirs: false, sourceLabel: "Shop/online", sourceShare: 0.65 }).note, "Assumes a shop/online price (65% of the sell price). Tap Buy to enter what you'd really pay.");
eq("a suggestion with no source named still says it is a suggestion", profitFraming({ buy: 5, sell: 10, buyIsTheirs: false }).note, "Tap Buy to enter what you'd really pay.");

// Their own price (typed in, or what they paid): their profit, with the ROI.
const t = profitFraming({ buy: 40, sell: 100, buyIsTheirs: true });
eq("their price: heading", t.heading, "Profit at your price of £40.00");
eq("their price: ROI shown", t.showRoi, true);
eq("their price: no assumption note", t.note, null);

// Losses are called losses, in both cases, and the heading never shows a minus sign in the money.
eq("their price above the sell price: a loss", profitFraming({ buy: 60, sell: 45, buyIsTheirs: true }).heading, "Loss at your price of £60.00");
eq("suggested price above the sell price: a loss scenario", profitFraming({ buy: 60, sell: 45, buyIsTheirs: false }).heading, "Loss if you buy at £60.00");
eq("break-even is a profit of nothing, not a loss", profitFraming({ buy: 50, sell: 50, buyIsTheirs: true }).heading, "Profit at your price of £50.00");

// The sentence a screen reader gets: the figure first, then the scenario.
eq("spoken, suggested buy", e.spoken, "Profit of £255.00 if you buy at £255.00");
eq("spoken, their price", t.spoken, "Profit of £60.00 at your price of £40.00");
eq("spoken, a loss", profitFraming({ buy: 60, sell: 45, buyIsTheirs: true }).spoken, "Loss of £15.00 at your price of £60.00");
eq("spoken, no prices", profitFraming({ buy: null, sell: null, buyIsTheirs: false }).spoken, "Estimated profit not available yet");

// No prices yet: nothing is invented, and no ROI.
eq("no buy price: plain heading", profitFraming({ buy: null, sell: 50, buyIsTheirs: false }).heading, "Estimated profit");
eq("no sell price: plain heading, no ROI", profitFraming({ buy: 20, sell: null, buyIsTheirs: true }).showRoi, false);
eq("neither: no note", profitFraming({ buy: null, sell: null, buyIsTheirs: true }).note, null);
eq("NaN is treated as missing", profitFraming({ buy: NaN, sell: 10, buyIsTheirs: true }).heading, "Estimated profit");

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
