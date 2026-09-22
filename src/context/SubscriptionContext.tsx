import { router } from "expo-router";
import Constants from "expo-constants";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOfferings,
} from "react-native-purchases";

import { getDeviceId } from "@/utils/deviceId";

type SubscriptionContextType = {
  isPro: boolean;
  offerings: PurchasesOfferings | null;
  purchase: (pkg: any) => Promise<void>;
  restore: () => Promise<void>;

  // A one-time (non-"pro") purchase — e.g. featuring a boot fair listing.
  // Unlike purchase(), this doesn't assume the "pro" entitlement or redirect
  // anywhere; the caller decides what a successful purchase unlocks.
  purchaseProduct: (pkg: any) => Promise<{ success: boolean; cancelled?: boolean }>;

  // True once RevenueCat is set up and usable. It stays false on web, in Expo
  // Go, and in builds that have no RevenueCat key.
  available: boolean;
  // True while a purchase or a restore is in progress.
  busy: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

// RevenueCat ships a real native module — it only works in a custom dev
// client / production build, never in Expo Go (which can't include
// arbitrary native modules) and never on web.
const REVENUECAT_SUPPORTED =
  Platform.OS !== "web" && Constants.appOwnership !== "expo";

// RevenueCat SDK keys are per platform. The old single key is still read as a
// fallback. EXPO_PUBLIC_ variables are swapped in at build time, so each one
// has to be written out in full here.
const REVENUECAT_KEY =
  (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    }) ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY
  )?.trim() || undefined;

const isProActive = (info: CustomerInfo) => !!info.entitlements.active["pro"];

const notifyUnavailable = () =>
  Alert.alert(
    "Purchases unavailable",
    "Purchases can't be started from this version of the app right now. Please try again later."
  );

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // ⭐ Initialize RevenueCat
  useEffect(() => {
    if (!REVENUECAT_SUPPORTED) return;

    const apiKey = REVENUECAT_KEY;
    if (!apiKey) {
      console.log("RevenueCat is not set up: no API key for this platform.");
      return;
    }

    let cancelled = false;

    // Keeps isPro right when a renewal, expiry or refund happens, or the
    // same account buys or restores on another device.
    const onCustomerInfo = (info: CustomerInfo) => setIsPro(isProActive(info));

    async function init(key: string) {
      try {
        await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

        // Fast Refresh runs this again; RevenueCat should only be set up once.
        if (!(await Purchases.isConfigured())) {
          // Our own device id (see src/utils/deviceId.ts) as the app user id,
          // so the backend can look a device's subscription status up
          // directly from RevenueCat instead of trusting a client-reported
          // isPro flag (see backend/subscriptions/revenueCat.ts).
          const deviceId = await getDeviceId();
          Purchases.configure({ apiKey: key, appUserID: deviceId });
        }
      } catch (err) {
        console.log("RevenueCat init error:", err);
        return;
      }

      if (cancelled) return;
      setAvailable(true);
      Purchases.addCustomerInfoUpdateListener(onCustomerInfo);

      // Separate requests, so one failing does not stop the other.
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        if (!cancelled) setIsPro(isProActive(customerInfo));
      } catch (err) {
        console.log("RevenueCat customer info error:", err);
      }

      try {
        const offs = await Purchases.getOfferings();
        if (!cancelled) setOfferings(offs);
      } catch (err) {
        console.log("RevenueCat offerings error:", err);
      }
    }

    init(apiKey);

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfo);
    };
  }, []);

  // ⭐ Purchase handler
  const purchase = async (pkg: any) => {
    if (!available) {
      notifyUnavailable();
      return;
    }
    // A second tap while a purchase is open must not start another one.
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = isProActive(customerInfo);
      setIsPro(active);

      if (active) {
        // ⭐ Redirect to success animation
        router.push("/pro-success");
      } else {
        Alert.alert(
          "Pro isn't showing yet",
          "Your purchase went through, but Pro hasn't unlocked yet. Try Restore Purchases in a moment."
        );
      }
    } catch (err: any) {
      if (!err?.userCancelled) {
        console.log("Purchase error:", err);
        Alert.alert(
          "Purchase didn't complete",
          "Something went wrong while completing your purchase. Please try again. If you were charged, tap Restore Purchases."
        );
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // ⭐ One-time purchase (not the "pro" entitlement) — e.g. featuring a boot
  // fair listing. The caller applies whatever the purchase unlocks itself;
  // this only reports whether the purchase actually went through.
  const purchaseProduct = async (pkg: any): Promise<{ success: boolean; cancelled?: boolean }> => {
    if (!available) {
      notifyUnavailable();
      return { success: false };
    }
    if (inFlight.current) return { success: false };
    inFlight.current = true;
    setBusy(true);

    try {
      await Purchases.purchasePackage(pkg);
      return { success: true };
    } catch (err: any) {
      if (err?.userCancelled) return { success: false, cancelled: true };

      console.log("Purchase error:", err);
      Alert.alert(
        "Purchase didn't complete",
        "Something went wrong while completing your purchase. Please try again. If you were charged, contact support."
      );
      return { success: false };
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // ⭐ Restore purchases
  const restore = async () => {
    if (!available) {
      notifyUnavailable();
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);

    try {
      const info = await Purchases.restorePurchases();
      const active = isProActive(info);
      setIsPro(active);

      Alert.alert(
        active ? "Purchases restored" : "Nothing to restore",
        active
          ? "FlipPilot Pro is unlocked on this device."
          : "We couldn't find an active FlipPilot Pro subscription for this account."
      );
    } catch (err) {
      console.log("Restore error:", err);
      Alert.alert(
        "Couldn't restore purchases",
        "Please check your connection and try again."
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        offerings,
        purchase,
        purchaseProduct,
        restore,
        available,
        busy,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext)!;
