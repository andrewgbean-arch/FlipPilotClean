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
