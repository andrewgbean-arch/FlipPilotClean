/**
 * Where the legal pages live and who to contact. Read from the build's
 * environment so they can be set when the policy and terms are published,
 * without a code change:
 *
 *   EXPO_PUBLIC_PRIVACY_POLICY_URL   the hosted privacy policy
 *   EXPO_PUBLIC_TERMS_URL            the hosted terms of use
 *   EXPO_PUBLIC_SUPPORT_EMAIL        where to send reports, questions and data requests
 *   EXPO_PUBLIC_BUSINESS_NAME        the legal name of the business, for the About screen
 *
 * Both app stores need the policy link to work before an app can be published.
 * Anything unset shows an honest "not set up in this build" message rather
 * than a dead link, so a build missing them is obvious when testing.
 */
export const LEGAL = {
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() ?? "",
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() ?? "",
  // The public contact address. A build can override it with the variable above; otherwise this is used,
  // so "For dealers" and "Advertise your business" open an email to us from day one.
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || "flippilot@hotmail.com",
  businessName: process.env.EXPO_PUBLIC_BUSINESS_NAME?.trim() ?? "",
  // Where "For dealers" and "Advertise your business" go. Until a page exists
  // they open an email enquiry to the support address instead (partnerLinks.ts).
  dealersUrl: process.env.EXPO_PUBLIC_DEALERS_URL?.trim() ?? "",
  advertiseUrl: process.env.EXPO_PUBLIC_ADVERTISE_URL?.trim() ?? "",
} as const;

/** Bump when the terms or privacy policy change in a way people must agree to again. */
export const LEGAL_VERSION = "1";

export const MINIMUM_AGE = 18;
