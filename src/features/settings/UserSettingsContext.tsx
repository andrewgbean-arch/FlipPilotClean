import React, { createContext, useContext, useState, ReactNode, useMemo } from "react";

export type UserSettingsContextType = {
  // NEW dealer mode API
  isDealer: boolean;
  setIsDealer: (v: boolean) => void;

  // LEGACY alias (for old screens)
  dealerMode: boolean;
  setDealerMode: (v: boolean) => void;
};

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export const UserSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [isDealer, setIsDealer] = useState(false);

  const value = useMemo(
    () => ({
      // new API
      isDealer,
      setIsDealer,

      // alias API (legacy)
      dealerMode: isDealer,
      setDealerMode: setIsDealer,
    }),
    [isDealer]
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error("Wrap your app in UserSettingsProvider");
  return ctx;
};
