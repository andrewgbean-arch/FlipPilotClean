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

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { calcFlipScore } from "@/features/vehicles/utils/calcFlipScore";
import { BASE_URL } from "@/utils/api";
import { useDealerNotifications } from "./DealerNotificationsContext";
import { useUserSettings } from "@/features/settings/UserSettingsContext";

// ⭐ Correct haptic helper
import { triggerHaptic } from "@/components/ui/haptics";

const STORAGE_KEY = "@flippilot_vehicle_history_v1";

// A raw copy of anything read from STORAGE_KEY that could not be used as it
// was, so a bad read can never turn into a permanent overwrite.
const BACKUP_KEY = "@flippilot_vehicle_history_v1_backup";

const READ_FAILED_MESSAGE =
  "We couldn't read your saved flips. Nothing has been deleted, but new flips can't be saved until the app can read them again. Try closing and reopening the app.";
const UNREADABLE_MESSAGE =
  "Your saved flips are stored in a format we couldn't read, so new flips can't be saved. Clearing your History will fix this.";
const NOT_SAVING_MESSAGE =
  "New flips and changes aren't being saved because your saved flips couldn't be loaded.";
const SAVE_FAILED_MESSAGE =
  "Your latest change couldn't be saved on this device. Check that you have free storage and try again.";

const PROFIT_MILESTONES = [1000, 5000, 10000, 25000, 50000];

// UUID v4 from the crypto polyfill imported above. This used to come from the
// "uuid" package, which is not a declared dependency of the app.
const newId = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const isStoredFlip = (v: unknown): v is FlipRecord =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  typeof (v as { id?: unknown }).id === "string" &&
  (v as { id: string }).id.length > 0;

const backUpRaw = async (raw: string) => {
  try {
    await AsyncStorage.setItem(BACKUP_KEY, raw);
  } catch (e) {
    console.log("VehicleHistory backup error", e);
  }
};

// Flips added while the saved list was still loading come first (they are the
// newest); the loaded list is never replaced by them, and they never replace it.
const mergeLoaded = (loadedList: FlipRecord[], current: FlipRecord[]) => {
  if (current.length === 0) return loadedList;
  const known = new Set(loadedList.map((v) => v.id));
  return [...current.filter((v) => !known.has(v.id)), ...loadedList];
};

const isScore = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

const clampScore = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

const money = (n: number) => `£${(Math.round(n * 100) / 100).toLocaleString()}`;

// Pure: returns the record with the patch applied. Nested objects are merged
// so a caller that sends only part of `ai` or `market` (the edit screen
// does) does not wipe the rest of them.
const applyUpdate = (v: FlipRecord, data: Partial<FlipRecord>): FlipRecord => {
  const updated: FlipRecord = {
    ...v,
    ...data,
    ...(data.ai && v.ai ? { ai: { ...v.ai, ...data.ai } } : {}),
    ...(data.market && v.market ? { market: { ...v.market, ...data.market } } : {}),
  };

  if (updated.buyPrice != null && updated.sellPrice != null) {
    updated.profit = updated.sellPrice - updated.buyPrice;
  } else if (data.buyPrice !== undefined || data.sellPrice !== undefined) {
    updated.profit = null;
  }

  // A score the caller supplied (the editor shows a live one) wins; otherwise
  // keep the stored one, and only fall back to the rough calculation if there
  // is none.
  updated.flipScore = isScore(data.flipScore)
    ? clampScore(data.flipScore)
    : isScore(v.flipScore)
    ? v.flipScore
    : calcFlipScore(updated);

  return updated;
};

type VehicleHistoryContextType = {
  vehicles: FlipRecord[];

  // True once the saved list has been read (or the read has failed). Before
  // that, `vehicles` is empty because it has not loaded yet, not because the
  // user has nothing saved.
  loaded: boolean;
  // Set when the saved list could not be read. Saving is switched off, so the
  // stored data is left alone, until clearAll() is used.
  loadError: string | null;
  // Set when changes are not reaching storage: either the last write failed,
  // or saving is switched off because of loadError.
  persistError: string | null;

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

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hydration = useRef<Promise<void>>(Promise.resolve());

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
  // null until the saved list has loaded; see the milestone effect below.
  const milestonesReached = useRef<number[] | null>(null);

  /* -------------------------------------------------------
     ⭐ LOAD VEHICLES
     Nothing is written to STORAGE_KEY until this has finished
     without an error (or found that the key is empty).
  ------------------------------------------------------- */
  useEffect(() => {
    const hydrate = async () => {
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(STORAGE_KEY);
      } catch (e) {
        // We don't know what is stored, so leave it exactly as it is.
        console.log("VehicleHistory load error", e);
        setLoadError(READ_FAILED_MESSAGE);
        setLoaded(true);
        return;
      }

      if (!raw) {
        setLoaded(true);
        return;
      }

      let list: FlipRecord[];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Saved history is not a list");

        list = parsed.filter(isStoredFlip);
        if (list.length !== parsed.length) {
          console.log(
            `VehicleHistory dropped ${parsed.length - list.length} unreadable entries`
          );
          // The next save rewrites the key without them, so keep what was there.
          await backUpRaw(raw);
        }
      } catch (e) {
        console.log("VehicleHistory parse error", e);
        await backUpRaw(raw);
        setLoadError(UNREADABLE_MESSAGE);
        setLoaded(true);
        return;
      }

      setVehicles((current) => mergeLoaded(list, current));
      setLoaded(true);
    };

    hydration.current = hydrate();
  }, []);

  /* -------------------------------------------------------
     ⭐ SAVE VEHICLES
  ------------------------------------------------------- */
  useEffect(() => {
    if (!loaded || loadError) return;

    // If another change arrives before this write finishes, its result is the
    // one that decides whether saving is failing.
    let stale = false;

    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
        if (!stale) setSaveError(null);
      } catch (e) {
        console.log("VehicleHistory save error", e);
        if (!stale) setSaveError(SAVE_FAILED_MESSAGE);
      }
    };
    save();

    return () => {
      stale = true;
    };
  }, [vehicles, loaded, loadError]);

  const persistError = loadError ? NOT_SAVING_MESSAGE : saveError;

  /* -------------------------------------------------------
     ⭐ CALCULATE TOTAL PROFIT + FIRE MILESTONES
  ------------------------------------------------------- */
  const totalProfit = useMemo(() => {
    return vehicles.reduce((sum, v) => sum + (v.profit ?? 0), 0);
  }, [vehicles]);

  useEffect(() => {
    if (!loaded) return;

    const reached = PROFIT_MILESTONES.filter((m) => totalProfit >= m);

    // First pass after loading: milestones the saved flips have already passed
    // are old news. Only ones crossed from here on are celebrated.
    const seen = milestonesReached.current;
    if (seen === null) {
      milestonesReached.current = reached;
      return;
    }

    reached.forEach((m) => {
      if (seen.includes(m)) return;
      seen.push(m);

      triggerHaptic();
      flash();

      addNotification({
        type: "SYSTEM",
        title: "Profit Milestone",
        message: `Profit across your saved flips has reached £${m.toLocaleString()}.`,
      });
    });
  }, [totalProfit, loaded]);

  /* -------------------------------------------------------
     ⭐ ADD VEHICLE
  ------------------------------------------------------- */
  const addVehicle = (
    data: Omit<FlipRecord, "id" | "timestamp">
  ): FlipRecord => {
    const newVehicle: FlipRecord = {
      ...data,
      id: newId(),
      timestamp: new Date().toISOString(),
    };

    if (newVehicle.buyPrice != null && newVehicle.sellPrice != null) {
      newVehicle.profit = newVehicle.sellPrice - newVehicle.buyPrice;
    }

    // Keep the score the caller had (the scan result and the editor both show
    // one); calcFlipScore is only the fallback.
    newVehicle.flipScore = isScore(data.flipScore)
      ? clampScore(data.flipScore)
      : calcFlipScore(newVehicle);

    setVehicles((prev) => [newVehicle, ...prev]);
    setTempVehicle(newVehicle);

    triggerHaptic();

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
      prev.map((v) => (v.id === id ? applyUpdate(v, data) : v))
    );

    // Notifications are fired here, not inside the state updater above (which
    // has to stay pure), and only when this edit actually changes something
    // worth announcing.
    const before = vehicles.find((v) => v.id === id);
    if (!before) return;
    const after = applyUpdate(before, data);

    if (!before.sellDate && after.sellDate) {
      triggerHaptic();
      flash();

      addNotification({
        type: "SALE",
        title: "Flip Sold",
        message:
          after.sellPrice != null && after.profit != null
            ? `${after.title} sold for ${money(after.sellPrice)}. ${
                after.profit < 0
                  ? `Loss: ${money(-after.profit)}`
                  : `Profit: ${money(after.profit)}`
              }.`
            : `${after.title} was marked as sold.`,
      });
    }

    const scoreBefore = before.flipScore ?? null;
    const scoreAfter = after.flipScore ?? null;

    if (scoreAfter != null && scoreAfter >= 80 && (scoreBefore ?? 0) < 80) {
      triggerHaptic();
      flash();

      addNotification({
        type: "SYSTEM",
        title: "High Flip Score",
        message: `${after.title} has a strong flip score (${scoreAfter}).`,
      });
    }

    if (
      scoreAfter != null &&
      scoreAfter <= 30 &&
      scoreBefore != null &&
      scoreBefore > 30
    ) {
      triggerHaptic();

      addNotification({
        type: "SYSTEM",
        title: "Flip Score Warning",
        message: `${after.title} has a low flip score (${scoreAfter}).`,
      });
    }
  };

  /* -------------------------------------------------------
     ⭐ MOT REFRESH SUPPORT (real DVSA+DVLA merge endpoint)
  ------------------------------------------------------- */
  const refreshMot = async (vehicleId: string) => {
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle || !vehicle.mot?.reg) {
        return {
          success: false,
          error: "Add a registration number to this vehicle to refresh its MOT data.",
        };
      }

      const reg = vehicle.mot.reg;

      const response = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(reg)}`);
      const data = await response.json();

      if (!data.ok || !data.vehicle) {
        return {
          success: false,
          error:
            typeof data?.error === "string" ? data.error : "No vehicle data found.",
        };
      }

      const api = data.vehicle;
      const parsedMileage = api.mileage != null ? Number(api.mileage) : NaN;
      const newMileage = Number.isFinite(parsedMileage) ? parsedMileage : null;
      // When only the DVLA side answered, the MOT lists come back empty
      // because they were not looked up, not because there is nothing to show.
      const motAvailable = data.motAvailable !== false;

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

          // Anything the service did not send keeps its current value, so a
          // partial answer never blanks out details entered by hand.
          const old: NonNullable<FlipRecord["mot"]> = v.mot ?? {};

          // One point per MOT test: dated with the test, and skipped when the
          // mileage is the same as the latest point or the test is already there.
          const existingHistory = old.mileageHistory ?? [];
          const testDate: string | null = api.lastMotDate ?? null;
          const latestPoint = existingHistory[existingHistory.length - 1];
          const addPoint =
            newMileage != null &&
            testDate != null &&
            latestPoint?.mileage !== newMileage &&
            !existingHistory.some((p) => p.date === testDate);
          const mileageHistory = addPoint
            ? [...existingHistory, { date: testDate, mileage: newMileage }]
            : existingHistory;

          return {
            ...v,
            mot: {
              ...old,
              reg: mappedMot.reg,
              make: mappedMot.make ?? old.make ?? null,
              model: mappedMot.model ?? old.model ?? null,
              year: Number(mappedMot.year) || old.year || null,
              colour: mappedMot.colour ?? old.colour ?? null,
              mileage: mappedMot.mileage ?? old.mileage ?? null,
              motExpiry: mappedMot.motExpiry ?? old.motExpiry ?? null,
              expiryDate: mappedMot.expiryDate ?? old.expiryDate ?? null,
              taxStatus: mappedMot.taxStatus ?? old.taxStatus ?? null,
              advisories: motAvailable ? mappedMot.advisories : old.advisories ?? [],
              failures: motAvailable ? mappedMot.failures : old.failures ?? [],
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
      return {
        success: false,
        error: "Couldn't reach the MOT service. Check your connection and try again.",
      };
    }
  };

  /* -------------------------------------------------------
     ⭐ CLEAR ALL
  ------------------------------------------------------- */
  const clearAll = async () => {
    // Let a load that is still running finish first, so it cannot bring the
    // old list back afterwards.
    await hydration.current;

    try {
      // The backup goes too: the person asked for this data to be deleted.
      await AsyncStorage.multiRemove([STORAGE_KEY, BACKUP_KEY]);
      // The key is empty now, so saving is safe again after a failed load.
      setLoadError(null);
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
      loaded,
      loadError,
      persistError,
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
    [
      vehicles,
      loaded,
      loadError,
      persistError,
      tempVehicle,
      totalProfit,
      flashTrigger,
      dealerMode,
    ]
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
