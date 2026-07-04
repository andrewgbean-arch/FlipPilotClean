import { router } from "expo-router";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type SubscriptionContextType = {
  isPro: boolean;
  offerings: any | null;
  purchase: (pkg: any) => Promise<void>;
  restore: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [offerings, setOfferings] = useState<any | null>(null);
  const [isPro, setIsPro] = useState(false);

  // ⭐ Placeholder until backend is copied over
  useEffect(() => {
    console.log("SubscriptionContext: backend not connected yet");
  }, []);

  // ⭐ Update Pro status (backend will provide real data later)
  const updateProStatus = (info: any) => {
    setIsPro(!!info?.isPro);
  };

  // ⭐ Purchase handler (placeholder)
  const purchase = async (pkg: any) => {
    console.log("purchase() called — backend not connected yet");

    // Simulate success for now
    updateProStatus({ isPro: true });

    router.push("/pro-success");
  };

  // ⭐ Restore purchases (placeholder)
  const restore = async () => {
    console.log("restore() called — backend not connected yet");

    // Simulate restore
    updateProStatus({ isPro: true });
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
