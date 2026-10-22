/**
 * The scan-credit packs on sale. The KEY is the product id, which must be created with exactly
 * this name in RevenueCat, App Store Connect and Google Play (as a consumable / one-time product).
 * The value is how many scan credits one purchase gives.
 *
 * The server is the only place that decides what a purchase is worth: the app is sent this list
 * (GET /credits) to label its buttons, but credits are only ever granted from what RevenueCat
 * itself reports the account has bought.
 */
export const CREDIT_PACKS: Record<string, number> = {
  flippilot_credits_25: 25,
  flippilot_credits_50: 50,
  flippilot_credits_100: 100,
  flippilot_credits_200: 200,
};

// Retired 22 Oct 2026: FlipPilot is free to use with one Pro plan, so the packs are no longer offered (the list the app is sent is
// empty). The table above stays so anyone who already bought one can still claim it. CREDIT_PACKS_ON_SALE=1 offers them again.
const packsOnSale = () => /^(1|on|true|yes)$/i.test((process.env.CREDIT_PACKS_ON_SALE ?? "").trim());
export const creditPackList = () => (packsOnSale() ? Object.entries(CREDIT_PACKS).map(([productId, credits]) => ({ productId, credits })) : []);
