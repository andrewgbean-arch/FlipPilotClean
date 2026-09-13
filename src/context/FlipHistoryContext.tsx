import { createContext, useContext, useState, ReactNode } from "react";

export type FlipScan = {
  ai?: any;
  title: string;
  barcode?: string | null;
  base_price?: number | null;
  image?: string | null;
  pricing?: {
    recommendedBuyPrice?: number | null;
    recommendedSellPrice?: number | null;
    predictedProfit?: number | null;
  };
  flipScore?: number;
};

type FlipHistoryContextType = {
  history: FlipScan[];
  addToHistory: (scan: FlipScan) => void;
  tempScanData: FlipScan | null;
  setTempScanData: (v: FlipScan | null) => void;
};

const FlipHistoryContext = createContext<FlipHistoryContextType | null>(null);

export const FlipHistoryProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<FlipScan[]>([]);
  const [tempScanData, setTempScanData] = useState<FlipScan | null>(null);

  const addToHistory = (scan: FlipScan) => {
    setHistory((prev) => [scan, ...prev]);
  };

  return (
    <FlipHistoryContext.Provider
      value={{ history, addToHistory, tempScanData, setTempScanData }}
    >
      {children}
    </FlipHistoryContext.Provider>
  );
};

export const useFlipHistory = () => {
  const ctx = useContext(FlipHistoryContext);
  if (!ctx) throw new Error("Wrap your app in FlipHistoryProvider");
  return ctx;
};

