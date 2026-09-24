// A tiny global store tracking whether the backend is reachable, so a single
// banner can explain what is going on instead of every page going blank.

import { useSyncExternalStore } from "react";

export type ConnectionStatus = "unknown" | "online" | "offline";

interface ConnectionState {
  status: ConnectionStatus;
  /** Number of in-flight requests that have been pending for longer than the slow threshold. */
  slow: number;
  lastError: string | null;
  lastOnline: number | null;
}

let state: ConnectionState = { status: "unknown", slow: 0, lastError: null, lastOnline: null };
const listeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function emit(next: Partial<ConnectionState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function markOnline() {
  const wasOffline = state.status === "offline";
  if (state.status !== "online" || state.lastError) {
    emit({ status: "online", lastError: null, lastOnline: Date.now() });
  }
  if (wasOffline) reconnectListeners.forEach((l) => l());
}

export function markOffline(reason: string) {
  if (state.status !== "offline" || state.lastError !== reason) {
    emit({ status: "offline", lastError: reason });
  }
}

export function slowStarted() {
  emit({ slow: state.slow + 1 });
}

export function slowEnded() {
  emit({ slow: Math.max(0, state.slow - 1) });
}

export function getConnection(): ConnectionState {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called (once per transition) when the backend comes back after being offline. */
export function onReconnect(listener: () => void) {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribe, getConnection, getConnection);
}
