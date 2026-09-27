import axios from "axios";

/* --------------------------------------------------
   Is this device a real, paying subscriber to the Trader plan?

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
const API_BASE = (process.env.REVENUECAT_API_BASE || "https://api.revenuecat.com").replace(/\/+$/, "");

/**
 * The entitlements that mean "on the paid plan". The plan is called Trader (300 scans a month and
 * eBay export); before 2026-09-27 it was called Pro, and a subscriber under that name still counts.
 */
const PLAN_ENTITLEMENTS = ["trader", "pro"];

export type PlanStatus = {
  active: boolean;
  /** Names the current billing period: the date of the subscription's latest payment. Null when not active. */
  period: string | null;
  /** When the current period ends (the plan renews or stops then). Null when not active. */
  renewsOn: string | null;
};

const NOT_ON_PLAN: PlanStatus = { active: false, period: null, renewsOn: null };

// Only checked once a device's free scans are used up (see scanMeter.ts), so this cache just stops
// a device that keeps scanning from causing a RevenueCat call on every lookup.
const CACHE_TTL_MS = 5 * 60 * 1000;
// A "not on the plan" answer is only remembered briefly, so someone who has just subscribed isn't kept out for minutes.
const NOT_ON_PLAN_TTL_MS = 60 * 1000;
const cache = new Map<string, { status: PlanStatus; checkedAt: number }>();

/** Is this device on the paid plan, and which billing period is it in? Asked of RevenueCat itself, never the phone. */
export async function planStatus(deviceId: string): Promise<PlanStatus> {
  if (!REVENUECAT_SECRET_KEY) return NOT_ON_PLAN;

  const cached = cache.get(deviceId);
  if (cached && Date.now() - cached.checkedAt < (cached.status.active ? CACHE_TTL_MS : NOT_ON_PLAN_TTL_MS)) return cached.status;

  let status = NOT_ON_PLAN;
  let answered = true;
  try {
    const res = await axios.get(`${API_BASE}/v1/subscribers/${encodeURIComponent(deviceId)}`, {
      headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` },
      timeout: 5000,
    });
    const entitlements = res.data?.subscriber?.entitlements ?? {};
    for (const name of PLAN_ENTITLEMENTS) {
      const e = entitlements[name];
      if (!e) continue;
      const expires = e.expires_date ? new Date(e.expires_date).getTime() : null;
      if (expires !== null && !(expires > Date.now())) continue;
      status = {
        active: true,
        // Each renewal has its own payment date, so the monthly count starts again by itself.
        period: typeof e.purchase_date === "string" && e.purchase_date ? e.purchase_date : `no-date:${e.expires_date ?? name}`,
        renewsOn: typeof e.expires_date === "string" ? e.expires_date : null,
      };
      break;
    }
  } catch (err: any) {
    // Includes a 404 for a device RevenueCat has never seen: not on the plan either way.
    console.log("RevenueCat subscriber check failed:", err?.response?.status ?? err?.message);
    status = NOT_ON_PLAN;
    // Only a definite "RevenueCat has never seen this person" (404) is remembered. A timeout or a 5xx says nothing.
    answered = err?.response?.status === 404;
  }

  if (answered) cache.set(deviceId, { status, checkedAt: Date.now() });
  return status;
}

/** On the paid plan (Trader, or Pro under its old name)? Used where the plan unlocks a feature, such as eBay export. */
export async function isProSubscriber(deviceId: string): Promise<boolean> {
  return (await planStatus(deviceId)).active;
}

/** For tests: forget cached answers. */
export function clearPlanCache() {
  cache.clear();
}

/* --------------------------------------------------
   One-time purchases (scan credit packs).

   RevenueCat lists everything a user has bought outside subscriptions under
   `non_subscriptions`, each purchase with its own unique id. Credits are granted
   from THAT list only (never from anything the phone says), once per purchase id.
-------------------------------------------------- */

export type OneTimePurchase = { id: string; productId: string; storeTxn?: string };

/** Every one-time purchase RevenueCat has for this app user, or null if it can't be asked. */
export async function fetchOneTimePurchases(appUserId: string): Promise<OneTimePurchase[] | null> {
  if (!REVENUECAT_SECRET_KEY) return null;
  try {
    const res = await axios.get(`${API_BASE}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` },
      timeout: 8000,
    });
    const groups = res.data?.subscriber?.non_subscriptions;
    const out: OneTimePurchase[] = [];
    if (groups && typeof groups === "object") {
      for (const [productId, list] of Object.entries(groups)) {
        if (!Array.isArray(list)) continue;
        for (const p of list as any[]) if (p && typeof p.id === "string" && p.id) {
          out.push({ id: p.id, productId, ...(typeof p.store_transaction_id === "string" && p.store_transaction_id ? { storeTxn: p.store_transaction_id } : {}) });
        }
      }
    }
    return out;
  } catch (err: any) {
    // A 404 means RevenueCat has never seen this user: they have bought nothing.
    if (err?.response?.status === 404) return [];
    console.log("RevenueCat purchases check failed:", err?.response?.status ?? err?.message);
    return null;
  }
}

export const revenueCatConfigured = () => !!REVENUECAT_SECRET_KEY;
