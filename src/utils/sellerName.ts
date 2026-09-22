import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * What the seller wants to be called on their listings.
 *
 * Kept on the device and sent up with each listing. It is self-chosen and
 * checked against nothing, so it carries no more weight than the name on a
 * market stall — which is why nothing in the app treats it as proof of who
 * anybody is.
 */
const STORAGE_KEY = "flippilot.sellerName";

export const SELLER_NAME_MAX = 40;

/** One line, no double spaces, short enough to fit on a card. */
export function tidySellerName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, SELLER_NAME_MAX);
}

export async function getSellerName(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const name = stored ? tidySellerName(stored) : "";
    return name === "" ? null : name;
  } catch {
    return null;
  }
}

/** Saving an empty name clears it, rather than storing a blank. */
export async function setSellerName(raw: string): Promise<void> {
  const name = tidySellerName(raw);
  try {
    if (name === "") await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Nothing to do but carry on; the listing just goes up without a name.
  }
}
