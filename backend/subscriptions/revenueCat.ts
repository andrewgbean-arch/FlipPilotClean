import axios from "axios";

/* --------------------------------------------------
   Is this device a real, paying Pro subscriber?

   The app configures RevenueCat with our own device id as its app user id
   (see src/context/SubscriptionContext.tsx), so the same id sent with every
   scan request can be looked up directly against RevenueCat's own records.
   This is a genuine server-to-server check, not a client-reported flag - the
   app already has an isPro value, but trusting a value the client could just
   set to true would be the same class of bug already fixed once in
   rateLimit.ts (a client-supplied userId used to give unlimited requests).

   Needs REVENUECAT_SECRET_KEY in backend/.env - the *secret* REST API key
   from the RevenueCat dashboard (Project settings > API keys), not the
   public SDK key already used in the app. Until that's set, every device is
   treated as not-Pro, same as before this existed.
-------------------------------------------------- */

const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY;

// Only checked once a device is about to be blocked (see freeScanLimit.ts),
// so this cache just stops a device hammering the endpoint while capped from
// causing a RevenueCat call on every single retry.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { isPro: boolean; checkedAt: number }>();

export async function isProSubscriber(deviceId: string): Promise<boolean> {
  if (!REVENUECAT_SECRET_KEY) return false;

  const cached = cache.get(deviceId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached.isPro;

  let isPro = false;
  try {
    const res = await axios.get(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(deviceId)}`,
      { headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` }, timeout: 5000 }
    );
    const pro = res.data?.subscriber?.entitlements?.pro;
    isPro = !!pro && (!pro.expires_date || new Date(pro.expires_date).getTime() > Date.now());
  } catch (err: any) {
    // Includes a 404 for a device RevenueCat has never seen (not configured,
    // or never opened the app with purchases available) - not Pro either way.
    console.log("RevenueCat subscriber check failed:", err?.response?.status ?? err?.message);
    isPro = false;
  }

  cache.set(deviceId, { isPro, checkedAt: Date.now() });
  return isPro;
}
