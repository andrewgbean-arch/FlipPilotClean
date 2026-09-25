import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

/** What this person has for scanning: the free scans left this week and their credit balance. */
export type ScanAllowance = {
  /** False when the server isn't applying limits (development), so there is nothing to show. */
  metering: boolean;
  signedIn: boolean;
  credits: number;
  freeLeft: number;
  freeLimit: number;
  resetsOn: string;
  /** The packs on sale: the store product id and how many credits it gives. */
  packs: { productId: string; credits: number }[];
};

export async function fetchScanAllowance(): Promise<ScanAllowance | null> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/credits?deviceId=${encodeURIComponent(deviceId)}`);
    const json = await res.json();
    if (!json?.ok || !json.free) return null;
    return {
      metering: !!json.metering,
      signedIn: !!json.signedIn,
      credits: Number(json.credits) || 0,
      freeLeft: Number(json.free.left) || 0,
      freeLimit: Number(json.free.limit) || 5,
      resetsOn: String(json.free.resetsOn ?? ""),
      packs: Array.isArray(json.packs) ? json.packs.filter((p: any) => typeof p?.productId === "string" && Number(p.credits) > 0) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Asks the server to turn what this account has bought into credits. Safe to call at any time and
 * as often as you like: each purchase is only ever paid out once.
 */
export async function claimCredits(): Promise<{ ok: true; granted: number; credits: number } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/credits/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = await res.json().catch(() => null);
    if (json?.ok) return { ok: true, granted: Number(json.granted) || 0, credits: Number(json.credits) || 0 };
    return { ok: false, message: json?.message ?? "We couldn't check your purchases just now." };
  } catch {
    return { ok: false, message: "Couldn't reach FlipPilot. Check your connection and try again." };
  }
}
