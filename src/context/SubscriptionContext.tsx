import { router } from "expo-router";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
} from "react-native-purchases";

type SubscriptionContextType = {
  isPro: boolean;
  offerings: PurchasesOfferings | null;
  purchase: (pkg: any) => Promise<void>;
  restore: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isPro, setIsPro] = useState(false);

  // ⭐ Initialize RevenueCat
  useEffect(() => {
    async function init() {
      try {
        Purchases.setDebugLogsEnabled(true);

        await Purchases.configure({
          apiKey: process.env.EXPO_PUBLIC_REVENUECAT_KEY!,
        });

        // Load customer info
        const customerInfo = await Purchases.getCustomerInfo();
        updateProStatus(customerInfo);

        // Load offerings
        const offs = await Purchases.getOfferings();
        setOfferings(offs);
      } catch (err) {
        console.log("RevenueCat init error:", err);
      }
    }

    init();
  }, []);

  // ⭐ Update Pro status
  const updateProStatus = (info: CustomerInfo) => {
    const active = info.entitlements.active;
    setIsPro(!!active["pro"]);
  };

  // ⭐ Purchase handler
  const purchase = async (pkg: any) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      updateProStatus(customerInfo);

      // ⭐ Redirect to success animation
      router.push("/pro-success");

    } catch (err: any) {
      if (!err.userCancelled) {
        console.log("Purchase error:", err);
      }
    }
  };

  // ⭐ Restore purchases
  const restore = async () => {
    try {
      const info = await Purchases.restorePurchases();
      updateProStatus(info);
    } catch (err) {
      console.log("Restore error:", err);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        offerings,
        purchase,
        restore,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext)!;
