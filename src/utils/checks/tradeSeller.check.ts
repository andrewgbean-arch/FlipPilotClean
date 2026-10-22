// Run with: npx tsx src/utils/checks/tradeSeller.check.ts (from the app root).
// Trade sellers (22 Oct 2026): a dealer lists cars in the app without Dealer OS. This pins how the app reads what the server says
// and the words it puts to dealers. The reply below is the shape the server gives.
import {
  DEFAULT_TRADE_CAR_LIMIT,
  businessNameReady,
  parseTradeSellerStatus,
  tradeOfferWords,
  tradeScreenWords,
  tradeSellScreenLine,
  tradeSettingsRow,
} from "../../lib/tradeSellerRules";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail++;
    console.log("FAIL", label, "\n   got ", JSON.stringify(got), "\n   want", JSON.stringify(want));
  }
};

const notYet = parseTradeSellerStatus({ ok: true, tradeSeller: null, carLimit: 15, free: true })!;
const dealer = parseTradeSellerStatus({ ok: true, tradeSeller: { businessName: "A1 Autos", since: "2026-10-22T10:00:00.000Z" }, carLimit: 15, free: true })!;
const paying = parseTradeSellerStatus({ ok: true, tradeSeller: null, carLimit: 20, free: false })!;

// ---- reading the server's reply
eq("not a trade seller yet", notYet, { tradeSeller: null, carLimit: 15, free: true });
eq("a trade seller, with the name and date", dealer.tradeSeller, { businessName: "A1 Autos", since: "2026-10-22T10:00:00.000Z" });
eq("the limit and whether it is free come from the server", [paying.carLimit, paying.free], [20, false]);
eq("a reply that isn't ok is nothing", parseTradeSellerStatus({ ok: false }), null);
eq("nothing is nothing", parseTradeSellerStatus(null), null);
eq("a nonsense limit falls back to 15", parseTradeSellerStatus({ ok: true, tradeSeller: null, carLimit: "lots" })!.carLimit, DEFAULT_TRADE_CAR_LIMIT);
eq("a limit under 1 falls back too", parseTradeSellerStatus({ ok: true, tradeSeller: null, carLimit: 0 })!.carLimit, DEFAULT_TRADE_CAR_LIMIT);
eq("a trade record with no name is not one", parseTradeSellerStatus({ ok: true, tradeSeller: { businessName: "" }, carLimit: 15 })!.tradeSeller, null);
eq("free unless the server says it is not", parseTradeSellerStatus({ ok: true, tradeSeller: null, carLimit: 15 })!.free, true);

// ---- the name box
eq("ready: a normal name", businessNameReady("A1 Autos"), true);
eq("ready: spaces are tidied first", businessNameReady("  A1   Autos  "), true);
eq("not ready: empty", businessNameReady(""), false);
eq("not ready: only spaces", businessNameReady("    "), false);
eq("not ready: one character", businessNameReady("A"), false);
eq("ready: two characters", businessNameReady("AB"), true);
eq("ready: 60 characters", businessNameReady("x".repeat(60)), true);
eq("not ready: 61 characters", businessNameReady("x".repeat(61)), false);

// ---- the words
eq("offer while free", tradeOfferWords(notYet), "List up to 15 cars at once, free while we launch.");
eq("offer once it is not free", tradeOfferWords(paying), "List up to 20 cars at once.");
eq("Settings row, not a trade seller", tradeSettingsRow(notYet), { title: "Sell as a dealer", subtitle: "List up to 15 cars at once, free while we launch." });
eq("Settings row, before the server has answered", tradeSettingsRow(null), { title: "Sell as a dealer", subtitle: "List up to 15 cars at once, free while we launch." });
eq("Settings row, a trade seller", tradeSettingsRow(dealer), { title: "Trade seller: A1 Autos", subtitle: "Up to 15 cars at once" });
eq("sell screen: nothing until the server has answered", tradeSellScreenLine(null), null);
eq("sell screen: invites a dealer", tradeSellScreenLine(notYet), "Are you a dealer? Sell up to 15 cars at once.");
eq("sell screen: tells a trade seller their allowance", tradeSellScreenLine(dealer), "Trade seller: up to 15 cars for sale at once, free while we launch.");
eq("sign-up screen: first time", tradeScreenWords(notYet), { heading: "Sell as a dealer", button: "Become a trade seller" });
eq("sign-up screen: already one", tradeScreenWords(dealer), { heading: "You're a trade seller as A1 Autos", button: "Save new name" });

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
