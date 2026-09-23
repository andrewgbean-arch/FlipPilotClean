import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

/**
 * A person's data rights: get a copy of what we hold about them, or have it
 * deleted. Their saved flips and photos live on their phone and are not here.
 */

export async function exportMyData(): Promise<string> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/me/export`, { headers: { "x-device-id": deviceId } });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't get your data.");
  return JSON.stringify(data.data, null, 2);
}

export type DeletionSummary = {
  listingsRemoved: number;
  fairsRemoved: number;
  messagesRemoved: number;
  sellerProfileRemoved: boolean;
  reviewsRemoved: number;
  photosRemoved: number;
  ebayDisconnected: boolean;
};

export async function deleteMyData(): Promise<DeletionSummary> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/me/data`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't delete your data.");
  return data.removed as DeletionSummary;
}

export async function deleteMyListing(id: string | number): Promise<void> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/listings/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    headers: { "x-device-id": deviceId },
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't delete that listing.");
}

export async function deleteMyFair(id: string): Promise<void> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/fairs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "x-device-id": deviceId },
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't remove that boot fair.");
}
