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

export const creditPackList = () => Object.entries(CREDIT_PACKS).map(([productId, credits]) => ({ productId, credits }));
