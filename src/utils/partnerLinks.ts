import { Alert, Linking } from "react-native";

import { LEGAL } from "@/constants/legal";
import { API_CONFIGURED, BASE_URL } from "@/utils/api";

export type PartnerLinkKind = "dealers" | "advertise";

export const PARTNER_LINKS: Record<
  PartnerLinkKind,
  { title: string; text: string; button: string; subject: string; body: string; url: () => string }
> = {
  dealers: {
    title: "Car dealer?",
    text: "Manage your stock and list your cars on FlipPilot Marketplace free with FlipPilot Dealer OS.",
    button: "Find out more",
    subject: "FlipPilot Dealer OS enquiry",
    body: "Hello, I'm a car dealer and I'd like to know more about FlipPilot Dealer OS and listing my stock on the Marketplace.\n\nDealership name:\nWebsite:\nPhone:",
    url: () => LEGAL.dealersUrl,
  },
  advertise: {
    title: "Advertise your business",
    text: "Reach local sellers and buyers with a sponsored spot in FlipPilot. See the prices, add your logo and photos, and book online.",
    button: "Advertise with us",
    subject: "FlipPilot advertising enquiry",
    body: "Hello, I'd like to advertise my business in FlipPilot.\n\nBusiness name:\nWebsite:\nPhone:\nWhat I'd like to promote:",
    // The advertising portal on our own server (a business books, pays and follows its adverts there),
    // unless EXPO_PUBLIC_ADVERTISE_URL points somewhere else.
    url: () => LEGAL.advertiseUrl || (API_CONFIGURED ? `${BASE_URL.replace(/\/+$/, "")}/advertise/` : ""),
  },
};

/**
 * Opens the page for dealers or for advertisers. With no page set up yet it
 * opens an email to the support address with the enquiry started, so the link
 * works from day one. With neither, it says so instead of doing nothing.
 */
export function openPartnerLink(kind: PartnerLinkKind) {
  const link = PARTNER_LINKS[kind];

  const page = link.url();
  if (page) {
    Linking.openURL(page).catch(() => Alert.alert("Couldn't open the link", page));
    return;
  }

  if (LEGAL.supportEmail) {
    const mailto = `mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent(link.subject)}&body=${encodeURIComponent(link.body)}`;
    Linking.openURL(mailto).catch(() =>
      Alert.alert("Couldn't open your email app", `Please email ${LEGAL.supportEmail}`)
    );
    return;
  }

  Alert.alert(`${link.title} isn't set up in this build`, "A contact address has to be added before the app is released.");
}
