import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FlipRecord } from "../models/FlipRecord";

// ⭐ UUID polyfill for React Native

import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "@flippilot_history";

/* ================================
   ⭐ DUPLICATE DETECTION
================================ */
function findDuplicate(
  existing: FlipRecord[],
  incoming: { title: string; barcode?: string | null }
): FlipRecord | null {
  if (incoming.barcode) {
    const match = existing.find(
      (f) => f.barcode && f.barcode === incoming.barcode
    );
    if (match) return match;
  }

  const exact = existing.find(
    (f) =>
      f.title.trim().toLowerCase() === incoming.title.trim().toLowerCase()
  );
  if (exact) return exact;

  const loose = existing.find((f) =>
    f.title.toLowerCase().includes(incoming.title.toLowerCase())
  );
  if (loose) return loose;

  return null;
}

/* ================================
   ⭐ SCAN DATA TYPE
================================ */
export type ScanData = {
  ai?: any;
  market?: any;
  pricing?: any;

  ebayItems?: any[];

  flipScore?: number;
  flipPotential?: string;
  sellSpeed?: string;
  rarity?: string;
  insights?: string;

  image?: string | null;
  title?: string;
  barcode?: string | null;

  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;
};

/* ================================
   ⭐ CONTEXT TYPE
================================ */
type FlipHistoryContextType = {
  flips: FlipRecord[];
  addFlip: (flip: Omit<FlipRecord, "id" | "timestamp">) => Promise<FlipRecord>;

  deleteFlip: (id: string) => void;
  toggleFavourite: (id: string) => void;
  clearAll: () => Promise<void>;

  tempScanData: ScanData | null;
  setTempScanData: (data: ScanData | null) => void;

  addToHistory: (scan: ScanData) => void;
};

const FlipHistoryContext = createContext<FlipHistoryContextType | null>(null);

/* ================================
   ⭐ PROVIDER
================================ */
type ProviderProps = { children: ReactNode };

export const FlipHistoryProvider = ({ children }: ProviderProps) => {
  const [flips, setFlips] = useState<FlipRecord[]>([]);
  const [tempScanData, setTempScanData] = useState<ScanData | null>(null);

  /* ================================
     ⭐ LOAD ON START
  ================================= */
  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const parsed: FlipRecord[] = JSON.parse(data);
        setFlips(parsed);
      } catch (e) {
        console.log("FlipHistory load error", e);
        setFlips([]);
      }
    };

    load();
  }, []);

  /* ================================
     ⭐ SAVE ON CHANGE
  ================================= */
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flips));
      } catch (e) {
        console.log("FlipHistory save error", e);
      }
    };

    if (flips) save();
  }, [flips]);

  /* ================================
     ⭐ ADD FLIP (OLD SYSTEM)
  ================================= */
  const addFlip = async (
    flip: Omit<FlipRecord, "id" | "timestamp">
  ): Promise<FlipRecord> => {
    const duplicate = findDuplicate(flips, {
      title: flip.title,
      barcode: flip.barcode,
    });

    if (duplicate) return duplicate;

    const newFlip: FlipRecord = {
      ...flip,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    setFlips((prev) => [newFlip, ...prev]);
    return newFlip;
  };

  /* ================================
     ⭐ ADD TO HISTORY (SCAN RESULTS)
  ================================= */
  const addToHistory = (scan: ScanData) => {
    const record: FlipRecord = {
      id: uuidv4(),
      title: scan.title ?? scan.ai?.title ?? "Untitled",
      barcode: scan.barcode ?? null,
      image: scan.image ?? null,
      favourite: false,
      timestamp: new Date().toISOString(),

      ai: scan.ai ?? null,
      market: scan.market ?? null,
      pricing: scan.pricing ?? null,

      flipScore: scan.flipScore ?? null,
      flipPotential: scan.flipPotential ?? null,
      sellSpeed: scan.sellSpeed ?? null,
      rarity: scan.rarity ?? null,
      insights: scan.insights ?? null,

      aiPriceMin: scan.aiPriceMin ?? null,
      aiPriceMax: scan.aiPriceMax ?? null,
      aiPriceConfidence: scan.aiPriceConfidence ?? null,
    };

    setTempScanData(scan);
    setFlips((prev) => [record, ...prev]);
  };

  /* ================================
     ⭐ DELETE
  ================================= */
  const deleteFlip = (id: string) => {
    setFlips((prev) => prev.filter((f) => f.id !== id));
  };

  /* ================================
     ⭐ TOGGLE FAVOURITE
  ================================= */
  const toggleFavourite = (id: string) => {
    setFlips((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, favourite: !f.favourite } : f
      )
    );
  };

  /* ================================
     ⭐ CLEAR ALL
  ================================= */
  const clearAll = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log("FlipHistory clear error", e);
    }
    setFlips([]);
  };

  /* ================================
     ⭐ PROVIDER VALUE
  ================================= */
  const value = useMemo<FlipHistoryContextType>(
    () => ({
      flips,
      addFlip,
      deleteFlip,
      toggleFavourite,
      clearAll,
      tempScanData,
      setTempScanData,
      addToHistory,
    }),
    [flips, tempScanData]
  );

  return (
    <FlipHistoryContext.Provider value={value}>
      {children}
    </FlipHistoryContext.Provider>
  );
};

/* ================================
   ⭐ HOOK
================================ */
export const useFlipHistory = () => {
  const context = useContext(FlipHistoryContext);
  if (!context) throw new Error("Wrap app in FlipHistoryProvider");
  return context;
};
