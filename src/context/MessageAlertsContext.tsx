import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

type Value = {
  /** Someone has written since the inbox was last opened. Makes Home flash. */
  hasNew: boolean;
  newCount: number;
  /** Ask the server again now, for example after opening a chat. */
  refresh: () => void;
};

const MessageAlertsContext = createContext<Value>({ hasNew: false, newCount: 0, refresh: () => {} });

const POLL_MS = 20_000;

/**
 * Keeps the app's idea of "is there a new message?" up to date: every 20
 * seconds while the app is open, whenever it comes back to the front, and
 * whenever you move between screens (so opening the inbox or a chat calms the
 * flash straight away). It only asks the server; nothing is marked as seen by
 * asking.
 */
export function MessageAlertsProvider({ children }: { children: React.ReactNode }) {
  const [newCount, setNewCount] = useState(0);
  const pathname = usePathname();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/me/unread`, { headers: { "x-device-id": deviceId } });
      const data = await res.json();
      if (data?.ok) setNewCount(Number(data.newCount) || 0);
    } catch {
      // Offline or the server is down: leave what is showing as it is.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  // Moving between screens is a good moment to look again. A short delay lets a
  // chat or the inbox finish loading (which is what marks it as seen).
  useEffect(() => {
    const t = setTimeout(refresh, 800);
    return () => clearTimeout(t);
  }, [pathname, refresh]);

  const value = useMemo<Value>(
    () => ({ hasNew: newCount > 0, newCount, refresh }),
    [newCount, refresh]
  );

  return <MessageAlertsContext.Provider value={value}>{children}</MessageAlertsContext.Provider>;
}

export const useMessageAlerts = () => useContext(MessageAlertsContext);
