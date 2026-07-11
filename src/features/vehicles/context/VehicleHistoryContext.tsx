import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
// @ts-ignore
import { v4 as uuidv4 } from "uuid";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

const STORAGE_KEY = "@flippilot_vehicle_history_v1";

type VehicleHistoryContextType = {
  vehicles: FlipRecord[];
  addVehicle: (data: Omit<FlipRecord, "id" | "timestamp">) => FlipRecord;
  deleteVehicle: (id: string) => void;
  toggleFavourite: (id: string) => void;
  updateVehicle: (id: string, data: Partial<FlipRecord>) => void;   // ⭐ ADDED
  clearAll: () => Promise<void>;
  tempVehicle: FlipRecord | null;
  setTempVehicle: (v: FlipRecord | null) => void;
};

const VehicleHistoryContext = createContext<VehicleHistoryContextType | null>(
  null
);

type ProviderProps = { children: ReactNode };

export const VehicleHistoryProvider = ({ children }: ProviderProps) => {
  const [vehicles, setVehicles] = useState<FlipRecord[]>([]);
  const [tempVehicle, setTempVehicle] = useState<FlipRecord | null>(null);

  /* LOAD VEHICLES */
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setVehicles(parsed);
      } catch (e) {
        console.log("VehicleHistory load error", e);
        setVehicles([]);
      }
    };
    load();
  }, []);

  /* SAVE VEHICLES */
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
      } catch (e) {
        console.log("VehicleHistory save error", e);
      }
    };
    save();
  }, [vehicles]);

  /* ADD VEHICLE */
  const addVehicle = (
    data: Omit<FlipRecord, "id" | "timestamp">
  ): FlipRecord => {
    const newVehicle: FlipRecord = {
      ...data,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    setTempVehicle(newVehicle);
    return newVehicle;
  };

  /* DELETE VEHICLE */
  const deleteVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  /* TOGGLE FAVOURITE */
  const toggleFavourite = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, favourite: !v.favourite } : v
      )
    );
  };

  /* ⭐ UPDATE VEHICLE */
  const updateVehicle = (id: string, data: Partial<FlipRecord>) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, ...data } : v
      )
    );
  };

  /* CLEAR ALL */
  const clearAll = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log("VehicleHistory clear error", e);
    }
    setVehicles([]);
  };

  const value = useMemo<VehicleHistoryContextType>(
    () => ({
      vehicles,
      addVehicle,
      deleteVehicle,
      toggleFavourite,
      updateVehicle,   // ⭐ ADDED HERE
      clearAll,
      tempVehicle,
      setTempVehicle,
    }),
    [vehicles, tempVehicle]
  );

  return (
    <VehicleHistoryContext.Provider value={value}>
      {children}
    </VehicleHistoryContext.Provider>
  );
};

/* HOOK */
export const useVehicleHistory = () => {
  const ctx = useContext(VehicleHistoryContext);
  if (!ctx) throw new Error("Wrap your app in VehicleHistoryProvider");
  return ctx;
};
