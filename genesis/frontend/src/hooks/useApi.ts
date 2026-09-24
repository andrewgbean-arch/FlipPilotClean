import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, isAbortError, onReconnect } from "../api";

export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** True while a background refresh runs and data is already shown. */
  refreshing: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

interface Options {
  /** Re-fetch in the background every N ms (the previous data stays on screen). */
  refreshMs?: number;
  /** Skip fetching entirely while false. */
  enabled?: boolean;
}

/**
 * Fetch data with loading / error state, abort on unmount, optional polling, and an
 * automatic retry when the backend reconnects after being offline.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[], options: Options = {}): ApiState<T> {
  const { refreshMs, enabled = true } = options;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);
  const errorRef = useRef<string | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // Reset "has data" when the deps change, so a new query shows a loading state.
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    hasData.current = false;
  }, [depsKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        hasData.current = true;
        setDataState(result);
        setError(null);
        errorRef.current = null;
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        const msg = errorMessage(err);
        setError(msg);
        errorRef.current = msg;
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => controller.abort();
  }, [depsKey, tick, enabled]);

  // Poll.
  useEffect(() => {
    if (!refreshMs || !enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, enabled]);

  // Retry automatically when the backend comes back.
  useEffect(
    () =>
      onReconnect(() => {
        if (errorRef.current) setTick((t) => t + 1);
      }),
    [],
  );

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater));
    hasData.current = true;
  }, []);

  return { data, error, loading, refreshing, reload, setData };
}

/** Wrap an async action with pending / error state. */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending, error, setError };
}
