import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

export type ListingStatus = "available" | "reserved" | "sold" | "expired";

/** Seller: reserve one of your own listings, or put it back on sale. */
export async function setReserved(id: string | number, reserved: boolean): Promise<ListingStatus> {
  const deviceId = await getDeviceId();
  const res = await fetch(
    `${BASE_URL}/listings/${encodeURIComponent(String(id))}/${reserved ? "reserve" : "unreserve"}`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-device-id": deviceId }, body: "{}" }
  );
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't update the listing.");
  return data.status as ListingStatus;
}

/** Seller: start another 30 days for a listing that has run out. */
export async function relistListing(id: string | number): Promise<void> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/listings/${encodeURIComponent(String(id))}/relist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
    body: "{}",
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.message ?? data?.error ?? "Couldn't relist it.");
}

/** What went wrong with a boost, when the server says it is short of credits. */
export class BoostError extends Error {
  constructor(message: string, readonly code?: string, readonly credits?: number, readonly needed?: number) {
    super(message);
  }
}

/** The price and length of a boost, straight from the server so the app never quotes a stale number. */
export async function fetchBoostTerms(): Promise<{ cost: number; days: number } | null> {
  try {
    const res = await fetch(`${BASE_URL}/marketplace/policy`);
    const data = await res.json();
    if (typeof data?.boostCreditCost === "number" && typeof data?.boostDays === "number") {
      return { cost: data.boostCreditCost, days: data.boostDays };
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Seller: pay credits to put one of your own listings at the top of the feed for a while, labelled
 * Promoted. Takes nothing if it can't be done.
 */
export async function boostListing(id: string | number): Promise<{ boostedUntil: string; credits: number }> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/listings/${encodeURIComponent(String(id))}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
    body: "{}",
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    throw new BoostError(data?.message ?? data?.error ?? "Couldn't boost it.", data?.error, data?.credits, data?.needed);
  }
  return { boostedUntil: String(data.boostedUntil), credits: Number(data.credits) };
}

/**
 * Buyer: tell the seller you would like to buy it and ask them to reserve it.
 * It is an ordinary message in the conversation, so the seller can answer it,
 * and nothing is promised until they press Reserve.
 */
export async function askToReserve(id: string | number): Promise<void> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/messages/${encodeURIComponent(String(id))}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({
      message: "Hi, I'd like to buy this. Could you reserve it for me, please?",
    }),
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't send your request.");
}
