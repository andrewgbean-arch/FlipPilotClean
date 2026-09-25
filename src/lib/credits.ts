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
    };
  } catch {
    return null;
  }
}
