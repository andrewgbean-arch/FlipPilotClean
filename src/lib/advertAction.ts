import { Platform } from "react-native";
import * as Linking from "expo-linking";

import type { BusinessAdvert } from "./businessAdverts";

/**
 * What an advert's button says and does. A business chooses it when it books (advertising
 * portal): open its website, ring it, or show the way there in the phone's own maps app.
 * Anything it can't do (no number, no address) falls back to the website, and with no website
 * either there is no button.
 */
export type AdvertAction = { label: "Visit" | "Call" | "Directions"; url: string; accessibility: string };

export function advertAction(advert: BusinessAdvert): AdvertAction | null {
  const cta = advert.cta ?? "website";
  if (cta === "call" && advert.phone) {
    const digits = advert.phone.replace(/[^\d+]/g, "");
    return { label: "Call", url: `tel:${digits}`, accessibility: `Call ${advert.phone}` };
  }
  if (cta === "directions" && advert.address) {
    const q = encodeURIComponent(advert.address);
    const url = Platform.OS === "ios" ? `https://maps.apple.com/?q=${q}` : Platform.OS === "android" ? `geo:0,0?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    return { label: "Directions", url, accessibility: `Directions to ${advert.address}` };
  }
  if (advert.website) return { label: "Visit", url: advert.website, accessibility: "Visit website" };
  return null;
}

/** Opens the advert's button. A phone that can't (no maps app, no calling) quietly does nothing. */
export function openAdvertAction(action: AdvertAction | null): void {
  if (!action) return;
  Linking.openURL(action.url).catch(() => {
    // An Android phone with no maps app for geo: gets the web map instead.
    if (action.url.startsWith("geo:")) {
      const q = action.url.split("q=")[1] ?? "";
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
    }
  });
}
