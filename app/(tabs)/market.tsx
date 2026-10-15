import { Redirect } from "expo-router";

/**
 * Not a screen of its own: the bottom bar's "Market" button is only a LINK to the Marketplace, which lives
 * outside the tabs (app/marketplace). The bar forwards the tap itself (see _layout.tsx), so this only ever
 * renders if something opens "/market" directly, and then it just sends them on.
 *
 * (Deliberately not called "marketplace": a file of that name here would have the same address as the real
 * Marketplace screen, and the two would collide.)
 */
export default function MarketTab() {
  return <Redirect href="/marketplace" />;
}
