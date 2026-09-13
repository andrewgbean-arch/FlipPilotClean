import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { calcFlipScore } from "@/features/vehicles/utils/calcFlipScore";
import { BASE_URL } from "@/utils/api";
import { useDealerNotifications } from "./DealerNotificationsContext";
import { useUserSettings } from "@/features/settings/UserSettingsContext";

// ⭐ Correct haptic helper
import { triggerHaptic } from "@/components/ui/haptics";

const STORAGE_KEY = "@flippilot_vehicle_history_v1";

type VehicleHistoryContextType = {
  vehicles: FlipRecord[];
  addVehicle: (data: Omit<FlipRecord, "id" | "timestamp">) => FlipRecord;
  deleteVehicle: (id: string) => void;
  toggleFavourite: (id: string) => void;
  updateVehicle: (id: string, data: Partial<FlipRecord>) => void;
  clearAll: () => Promise<void>;
  tempVehicle: FlipRecord | null;
  setTempVehicle: (v: FlipRecord | null) => void;

  refreshMot: (vehicleId: string) => Promise<{ success: boolean; error?: any }>;

  totalProfit: number;

  // ⭐ GOLD FLASH
  flashTrigger: number;
  setFlashTrigger: (v: number) => void;

  // ⭐ UNIFIED DEALER MODE
  dealerMode: boolean;
  setDealerMode: (v: boolean) => void;
};

const VehicleHistoryContext = createContext<VehicleHistoryContextType | null>(
  null
);

export const VehicleHistoryProvider = ({ children }: { children: ReactNode }) => {
  const [vehicles, setVehicles] = useState<FlipRecord[]>([]);
  const [tempVehicle, setTempVehicle] = useState<FlipRecord | null>(null);

  const { addNotification } = useDealerNotifications();

  // ⭐ GOLD FLASH STATE
  const [flashTrigger, setFlashTrigger] = useState<number>(0);

  const flash = () => {
    setFlashTrigger(Date.now());
  };

  // ⭐ UNIFIED DEALER MODE
  const [dealerMode, setDealerMode] = useState(false);

  // Bridge to UserSettingsContext's isDealer — several screens (Motors
  // Notifications, Motors Analytics, the Dealer FAB) gate on isDealer
  // specifically, which otherwise never gets set anywhere in the app.
  const { setIsDealer } = useUserSettings();
  useEffect(() => {
    setIsDealer(dealerMode);
  }, [dealerMode]);

  /* -------------------------------------------------------
     ⭐ PROFIT MILESTONE TRACKING
  ------------------------------------------------------- */
  const milestonesReached = useRef<number[]>([]);
  const profitMilestones = [1000, 5000, 10000, 25000, 50000];

  /* -------------------------------------------------------
     ⭐ LOAD VEHICLES
  ------------------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed: FlipRecord[] = JSON.parse(raw);
        setVehicles(parsed);
      } catch (e) {
        console.log("VehicleHistory load error", e);
        setVehicles([]);
      }
    };
    load();
  }, []);

  /* -------------------------------------------------------
     ⭐ SAVE VEHICLES
  ------------------------------------------------------- */
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

  /* -------------------------------------------------------
     ⭐ CALCULATE TOTAL PROFIT + FIRE MILESTONES
  ------------------------------------------------------- */
  const totalProfit = useMemo(() => {
    return vehicles.reduce((sum, v) => sum + (v.profit ?? 0), 0);
  }, [vehicles]);

  useEffect(() => {
    profitMilestones.forEach((m) => {
      if (totalProfit >= m && !milestonesReached.current.includes(m)) {
        milestonesReached.current.push(m);

        triggerHaptic();
        flash();

        addNotification({
          type: "SYSTEM",
          title: "Profit Milestone",
          message: `Dealer milestone reached: £${m.toLocaleString()}`,
        });
      }
    });
  }, [totalProfit]);

  /* -------------------------------------------------------
     ⭐ ADD VEHICLE
  ------------------------------------------------------- */
  const addVehicle = (
    data: Omit<FlipRecord, "id" | "timestamp">
  ): FlipRecord => {
    const newVehicle: FlipRecord = {
      ...data,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    if (newVehicle.buyPrice != null && newVehicle.sellPrice != null) {
      newVehicle.profit = newVehicle.sellPrice - newVehicle.buyPrice;
    }

    newVehicle.flipScore = calcFlipScore(newVehicle);

    setVehicles((prev) => [newVehicle, ...prev]);
    setTempVehicle(newVehicle);

    triggerHaptic();

    addNotification({
      type: "STOCK",
      title: "Vehicle Added",
      message: `${newVehicle.title} added to stock.`,
    });

    return newVehicle;
  };

  /* -------------------------------------------------------
     ⭐ DELETE VEHICLE
  ------------------------------------------------------- */
  const deleteVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  /* -------------------------------------------------------
     ⭐ TOGGLE FAVOURITE
  ------------------------------------------------------- */
  const toggleFavourite = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, favourite: !v.favourite } : v
      )
    );
  };

  /* -------------------------------------------------------
     ⭐ UPDATE VEHICLE
  ------------------------------------------------------- */
  const updateVehicle = (id: string, data: Partial<FlipRecord>) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;

        const updated = { ...v, ...data };

        if (updated.buyPrice != null && updated.sellPrice != null) {
          updated.profit = updated.sellPrice - updated.buyPrice;

          triggerHaptic();
          flash();

          addNotification({
            type: "SALE",
            title: "Vehicle Sold",
            message: `${updated.title} sold for £${updated.sellPrice}. Profit: £${updated.profit}.`,
          });
        }

        updated.flipScore = calcFlipScore(updated);

        if (updated.flipScore != null) {
          if (updated.flipScore >= 80) {
            triggerHaptic();
            flash();

            addNotification({
              type: "SYSTEM",
              title: "High Flip Score",
              message: `${updated.title} has a strong flip score (${updated.flipScore}).`,
            });
          }

          if (updated.flipScore <= 30) {
            triggerHaptic();

            addNotification({
              type: "SYSTEM",
              title: "Flip Score Warning",
              message: `${updated.title} has a low flip score (${updated.flipScore}).`,
            });
          }
        }

        return updated;
      })
    );
  };

  /* -------------------------------------------------------
     ⭐ MOT REFRESH SUPPORT (real DVSA+DVLA merge endpoint)
  ------------------------------------------------------- */
  const refreshMot = async (vehicleId: string) => {
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle || !vehicle.mot?.reg) {
        return { success: false, error: "Vehicle or registration missing" };
      }

      const reg = vehicle.mot.reg;

      const response = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(reg)}`);
      const data = await response.json();

      if (!data.ok || !data.vehicle) {
        return { success: false, error: data?.error ?? "No vehicle data found" };
      }

      const api = data.vehicle;
      const newMileage = api.mileage != null ? Number(api.mileage) : null;

      const mappedMot = {
        reg,
        make: api.make ?? null,
        model: api.model ?? null,
        year: api.year ?? null,
        motExpiry: api.motExpiry ?? null,
        expiryDate: api.motExpiry ?? null,
        taxStatus: api.taxStatus ?? null,
        advisories: api.advisories?.map((a: any) => a.text ?? String(a)) ?? [],
        failures: api.failures?.map((f: any) => f.text ?? String(f)) ?? [],
        colour: api.colour ?? null,
        mileage: newMileage,
      };

      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id !== vehicleId) return v;

          const existingHistory = v.mot?.mileageHistory ?? [];
          const mileageHistory =
            newMileage != null
              ? [...existingHistory, { date: new Date().toISOString(), mileage: newMileage }]
              : existingHistory;

          return {
            ...v,
            mot: {
              ...v.mot,
              reg: mappedMot.reg,
              make: mappedMot.make,
              model: mappedMot.model,
              year: Number(mappedMot.year) || null,
              colour: mappedMot.colour,
              mileage: mappedMot.mileage,
              motExpiry: mappedMot.motExpiry,
              expiryDate: mappedMot.expiryDate,
              taxStatus: mappedMot.taxStatus,
              advisories: mappedMot.advisories,
              failures: mappedMot.failures,
              mileageHistory,
            },
          };
        })
      );

      triggerHaptic();

      addNotification({
        type: "MOT",
        title: "MOT Updated",
        message: `${vehicle.title} MOT data refreshed.`,
      });

      return { success: true };
    } catch (err) {
      console.log("MOT lookup failed:", err);
      return { success: false, error: err };
    }
  };

  /* -------------------------------------------------------
     ⭐ CLEAR ALL
  ------------------------------------------------------- */
  const clearAll = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log("VehicleHistory clear error", e);
    }
    setVehicles([]);
  };

  /* -------------------------------------------------------
     ⭐ CONTEXT VALUE
  ------------------------------------------------------- */
  const value = useMemo<VehicleHistoryContextType>(
    () => ({
      vehicles,
      addVehicle,
      deleteVehicle,
      toggleFavourite,
      updateVehicle,
      clearAll,
      tempVehicle,
      setTempVehicle,
      refreshMot,
      totalProfit,

      flashTrigger,
      setFlashTrigger,

      // ⭐ UNIFIED DEALER MODE
      dealerMode,
      setDealerMode,
    }),
    [vehicles, tempVehicle, totalProfit, flashTrigger, dealerMode]
  );

  return (
    <VehicleHistoryContext.Provider value={value}>
      {children}
    </VehicleHistoryContext.Provider>
  );
};

export const useVehicleHistory = () => {
  const ctx = useContext(VehicleHistoryContext);
  if (!ctx) throw new Error("Wrap your app in VehicleHistoryProvider");
  return ctx;
};
