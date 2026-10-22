import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import { parseTradeSellerStatus, type TradeSellerStatus } from "./tradeSellerRules";

// The words and the reading of what the server says live in ./tradeSellerRules (no React Native, so they can be checked).
export type { TradeSeller, TradeSellerStatus } from "./tradeSellerRules";

/** Is this phone a trade seller, and what are the rules? Null when the server can't be reached. */
export async function fetchTradeSeller(): Promise<TradeSellerStatus | null> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/trade-seller?deviceId=${encodeURIComponent(deviceId)}`);
    return parseTradeSellerStatus(await res.json());
  } catch {
    return null;
  }
}

/**
 * Says "I trade" with a business name (or changes the name). Signing in is needed; the app itself asks for it when the server
 * answers sign-in-required (see installAuthFetch in src/lib/account.ts), so that case only needs a quiet message here.
 */
export async function becomeTradeSeller(businessName: string): Promise<{ ok: true; status: TradeSellerStatus } | { ok: false; message: string }> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/trade-seller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, businessName }),
    });
    const json = await res.json().catch(() => null);
    const status = parseTradeSellerStatus(json);
    if (status) return { ok: true, status };
    if (json?.error === "sign-in-required") return { ok: false, message: "Please sign in with your email to carry on." };
    return { ok: false, message: typeof json?.message === "string" && json.message ? json.message : "We couldn't save that just now. Please try again." };
  } catch {
    return { ok: false, message: "Couldn't reach FlipPilot. Check your connection and try again." };
  }
}
