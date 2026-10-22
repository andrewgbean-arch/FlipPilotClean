import { allowedDeviceIds } from "../middleware/sellingGate";
import { isProSubscriber } from "../subscriptions/revenueCat";

/**
 * May this caller have a paid Google shop-price search? (See GOOGLE_SHOPPING in market-backend/fetchMarketData.ts.)
 *
 * Only a Pro subscriber, as RevenueCat itself says (never a flag from the phone), or a phone named in
 * SELLING_ALLOWED_DEVICE_IDS: the owner's test phones, so the paid behaviour can be tried on a real phone.
 * Asked only for an item that is worth a Google search, so most scans never cost a RevenueCat call.
 */
export async function googleAccessFor(deviceId: string | null | undefined): Promise<boolean> {
  if (!deviceId) return false;
  if (allowedDeviceIds().includes(deviceId)) return true;
  return isProSubscriber(deviceId);
}
