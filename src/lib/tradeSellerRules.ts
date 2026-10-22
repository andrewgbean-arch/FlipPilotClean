// What the app knows and says about trade sellers: dealers who list cars in the app itself, without the Dealer OS web app
// (22 Oct 2026). They give a business name, buyers see "Trade seller", and they may have several cars up at once where a
// private seller has one. The server decides all of it (backend/utils/tradeSeller.ts); this only reads what it says and puts it
// into words. Kept free of React Native so it can be checked on its own (src/utils/checks/tradeSeller.check.ts).

export type TradeSeller = { businessName: string; since: string };
export type TradeSellerStatus = { tradeSeller: TradeSeller | null; carLimit: number; free: boolean };

/** What the server is assumed to say when it does not say (it always does). */
export const DEFAULT_TRADE_CAR_LIMIT = 15;

/** Reads the server's reply to GET or POST /trade-seller. Null when it isn't a usable answer. */
export function parseTradeSellerStatus(json: any): TradeSellerStatus | null {
  if (!json?.ok) return null;
  const t = json.tradeSeller;
  const limit = Number(json.carLimit);
  return {
    tradeSeller: t && typeof t.businessName === "string" && t.businessName ? { businessName: t.businessName, since: String(t.since ?? "") } : null,
    carLimit: Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_TRADE_CAR_LIMIT,
    free: json.free !== false,
  };
}

/** The name box is ready to send. The server explains anything else that is wrong with a name (no web address, email or phone number). */
export function businessNameReady(raw: string): boolean {
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= 60;
}

/** One line for the dealer screen and Settings. */
export function tradeOfferWords(s: Pick<TradeSellerStatus, "carLimit" | "free">): string {
  return `List up to ${s.carLimit} cars at once${s.free ? ", free while we launch" : ""}.`;
}

/** The row in Settings: the offer for someone who is not a trade seller yet, their name for someone who is. */
export function tradeSettingsRow(s: TradeSellerStatus | null): { title: string; subtitle: string } {
  if (s?.tradeSeller) return { title: `Trade seller: ${s.tradeSeller.businessName}`, subtitle: `Up to ${s.carLimit} cars at once` };
  return { title: "Sell as a dealer", subtitle: tradeOfferWords(s ?? { carLimit: DEFAULT_TRADE_CAR_LIMIT, free: true }) };
}

/** The line on the sell screen's rules box. Nothing at all until the server has answered. */
export function tradeSellScreenLine(s: TradeSellerStatus | null): string | null {
  if (!s) return null;
  if (s.tradeSeller) return `Trade seller: up to ${s.carLimit} cars for sale at once${s.free ? ", free while we launch" : ""}.`;
  return `Are you a dealer? Sell up to ${s.carLimit} cars at once.`;
}

/** The sign-up screen's headline and button, which change once someone is a trade seller already. */
export function tradeScreenWords(s: TradeSellerStatus | null): { heading: string; button: string } {
  return s?.tradeSeller
    ? { heading: `You're a trade seller as ${s.tradeSeller.businessName}`, button: "Save new name" }
    : { heading: "Sell as a dealer", button: "Become a trade seller" };
}
