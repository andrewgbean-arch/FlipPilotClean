import { useEffect, useState } from "react";

import { loadRotation } from "@/lib/adRotation";
import { BASE_URL } from "@/utils/api";
import type { BusinessAdvert } from "@/lib/businessAdverts";

/**
 * Where the app gets its adverts from: the server, which only ever returns what
 * is booked, approved and in date today. If the server can't be reached, or has
 * nothing, no advert is shown at all. There is never a filler or a default.
 *
 * The answer is kept for a few minutes so the scan-wait screen has it ready the
 * moment it is needed: it can't wait for a network call when a scan is only
 * taking a second or two.
 */

export type ScanAdverts = { layout: "full" | "panels"; adverts: BusinessAdvert[] };
export type FeedAdverts = { adverts: BusinessAdvert[] };
export type BootfairAdverts = { adverts: BusinessAdvert[] };

type Placement = "scan" | "feed" | "bootfairs";

const KEEP_MS = 5 * 60_000;
const TIMEOUT_MS = 4000;

const cache: Partial<Record<Placement, { at: number; data: any }>> = {};
const inflight: Partial<Record<Placement, Promise<void>>> = {};

/** Asks the server again, unless it was asked recently. Quiet on any failure. */
export function refreshAdverts(placement: Placement, force = false): Promise<void> {
  // What this phone showed before is needed to choose fairly, so read it early.
  loadRotation();
  const hit = cache[placement];
  if (!force && hit && Date.now() - hit.at < KEEP_MS) return Promise.resolve();
  if (inflight[placement]) return inflight[placement]!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  inflight[placement] = fetch(`${BASE_URL}/adverts?placement=${placement}`, { signal: controller.signal })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.ok && Array.isArray(data.adverts)) cache[placement] = { at: Date.now(), data };
    })
    .catch(() => {
      // No answer: whatever was known before stays, and nothing new is invented.
    })
    .finally(() => {
      clearTimeout(timer);
      delete inflight[placement];
    });
  return inflight[placement]!;
}

/** The current adverts for a place, refreshed in the background when they are out of date. */
export function useAdverts<T extends { adverts: BusinessAdvert[] }>(placement: Placement, empty: T): T {
  const [data, setData] = useState<T>(() => (cache[placement]?.data as T) ?? empty);

  useEffect(() => {
    let live = true;
    refreshAdverts(placement).then(() => {
      const fresh = cache[placement]?.data as T | undefined;
      if (live && fresh) setData(fresh);
    });
    return () => {
      live = false;
    };
  }, [placement]);

  return data;
}

const lastCounted = new Map<string, number>();

/**
 * Counts a view or a tap. Counts only: nothing about who. A view can be given a
 * quiet period so scrolling back past the same advert in a feed isn't counted
 * again and again.
 */
export function reportAdvertEvent(id: string, type: "view" | "click", quietMinutes = 0): void {
  if (type === "view" && quietMinutes > 0) {
    const last = lastCounted.get(id) ?? 0;
    if (Date.now() - last < quietMinutes * 60_000) return;
    lastCounted.set(id, Date.now());
  }
  fetch(`${BASE_URL}/adverts/${encodeURIComponent(id)}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}
