import { getDeviceId } from "@/utils/deviceId";
import { BASE_URL } from "@/utils/api";

export interface Fair {
  id: string;
  // Whether this device listed the fair. The server works it out; the owner's
  // device id itself is never sent to anyone.
  isMine?: boolean;

  name: string;
  postcode: string;
  nextDate: string;
  daysOfWeek: string[];
  entryFee: string;
  stallFee: string;
  openingTime: string;
  closingTime: string;
  cancelledDueToWeather: boolean;

  website?: string;
  email: string;
  displayEmailPublicly?: boolean;
  categories: string[];
  phone?: string;

  address: string;
  lat: number;
  lng: number;
  hours: string;
  frequency: string;

  images: string[];
  // ISO timestamp; the fair is featured while this is set and in the future.
  // Set by paying to promote a listing (see bootfairs/details.tsx), never by
  // the client directly - the server ignores this field on create.
  featuredUntil?: string | null;
  busyScore: number;
  description: string;
  verified: boolean;
  lastUpdated: string;

  social: Record<string, string>;

  parking: boolean;
  toilets: boolean;
  foodStalls: boolean;
  dogFriendly: boolean;
  wheelchairAccessible: boolean;

  indoor: boolean;
  weatherSafe: boolean;

  estimatedStalls: number;
  estimatedVisitors: number;

  acceptsCard: boolean;
  acceptsCash: boolean;
}

export function isFeatured(fair: Fair): boolean {
  return Boolean(fair.featuredUntil) && new Date(fair.featuredUntil!).getTime() > Date.now();
}

// Every boot fair, fête, market or garage sale anyone has listed - this is a
// shared backend now, not per-device storage. Lists, details and search must
// all read from here so a listing is visible to everyone, not just its own
// organiser's phone.
export async function getAllFairs(): Promise<Fair[]> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/fairs`, { headers: { "x-device-id": deviceId } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// The `id` on `fair` is whatever the caller put there (bootfairs/add.tsx
// still builds a full Fair object) - the server always mints the real one
// and ignores it, along with ownerDeviceId, verified, featuredUntil etc.
export async function addUserFair(fair: Fair): Promise<Fair> {
  const deviceId = await getDeviceId();

  const res = await fetch(`${BASE_URL}/fairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fair, deviceId }),
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // Not JSON - the !res.ok check below turns this into an error.
  }

  if (!res.ok || !payload?.ok || !payload.fair) {
    throw new Error(payload?.error || "Couldn't save your boot fair.");
  }

  return payload.fair as Fair;
}

// Patches one of THIS device's own fairs (cancelledDueToWeather,
// featuredUntil) and returns the updated fair, or null if the request was
// rejected (not found, or not this device's fair to manage).
export async function updateUserFair(id: string, patch: Partial<Fair>): Promise<Fair | null> {
  const deviceId = await getDeviceId();

  try {
    const res = await fetch(`${BASE_URL}/fairs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, deviceId }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    return data?.ok && data.fair ? (data.fair as Fair) : null;
  } catch {
    return null;
  }
}
