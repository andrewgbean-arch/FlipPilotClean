import Purchases from "react-native-purchases";

/**
 * RevenueCat knows a person by the id the app gave it, and the server looks purchases up by the
 * account's own id. When signing in or out changes the phone's id, RevenueCat has to be told, or
 * a pack bought afterwards would be filed under the wrong person.
 *
 * Does nothing where RevenueCat isn't running (web, Expo Go, a build with no key).
 */
export async function syncPurchasesIdentity(id: string): Promise<void> {
  try {
    if (await Purchases.isConfigured()) await Purchases.logIn(id);
  } catch (err) {
    console.log("RevenueCat identity change failed:", err);
  }
}
