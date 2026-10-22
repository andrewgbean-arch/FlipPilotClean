import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import { parseScanAllowance, type ScanAllowance } from "./scanAllowance";

// What the person has for scanning (free scans this month, Pro, any credits held) and the words for it live in ./scanAllowance.
export type { ScanAllowance };

export async function fetchScanAllowance(): Promise<ScanAllowance | null> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/credits?deviceId=${encodeURIComponent(deviceId)}`);
    return parseScanAllowance(await res.json());
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
