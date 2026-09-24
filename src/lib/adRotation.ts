import { useEffect, useState } from "react";

import { leastRecentFirst } from "@/utils/rotationOrder";
import { loadItem, saveItem } from "@/utils/storage";

/**
 * Makes adverts take turns on each phone, so the same person isn't shown the
 * same advert again and again while others wait.
 *
 * The phone remembers when it last showed each advert (nothing else, and it
 * never leaves the phone), and whenever it has a choice it shows the one it
 * showed longest ago. An advert it has never shown goes first.
 */

const KEY = "flippilot.adRotation.v1";
const FORGET_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

let lastShown: Record<string, number> = {};
let loading: Promise<void> | null = null;
let ready = false;

/** Reads what was shown before. Safe to call any number of times. */
export function loadRotation(): Promise<void> {
  if (!loading) {
    loading = loadItem(KEY)
      .then((saved) => {
        if (saved && typeof saved === "object") {
          const cutoff = Date.now() - FORGET_AFTER_MS;
          for (const [id, at] of Object.entries(saved)) {
            if (typeof at === "number" && at > cutoff && !(id in lastShown)) lastShown[id] = at;
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        ready = true;
      });
  }
  return loading;
}

/** Note that this advert has just been shown on this phone. */
export function markShown(id: string): void {
  lastShown[id] = Date.now();
  saveItem(KEY, lastShown);
}

/**
 * The adverts in the order this phone should show them. Empty until what was
 * shown before has been read, so the first choice is never made blind. Fixed
 * once chosen: showing one doesn't reshuffle the rest mid-screen.
 */
export function useRotated<T extends { id: string }>(adverts: T[]): T[] {
  const [order, setOrder] = useState<T[]>(() => (ready ? leastRecentFirst(adverts, lastShown) : []));

  useEffect(() => {
    let live = true;
    loadRotation().then(() => {
      if (live) setOrder(leastRecentFirst(adverts, lastShown));
    });
    return () => {
      live = false;
    };
  }, [adverts]);

  return order;
}
