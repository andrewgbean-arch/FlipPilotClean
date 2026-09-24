import { useEffect, useState } from "react";

import type { BusinessAdvert } from "@/lib/businessAdverts";
import { loadItem, saveItem } from "@/utils/storage";

/**
 * Sponsors a person has kept to look at later, shown at the top of Messages.
 *
 * It exists so nobody has to leave what they are doing to look at an advert:
 * opening an advertiser's website in the middle of a scan takes them out of the
 * app and can lose the scan. Saving keeps it, and they can visit it afterwards.
 *
 * Kept only on this phone. Nothing is sent to anyone except a plain count that
 * an advert was saved (so the advertiser can be told), never who saved it.
 */

const KEY = "flippilot.savedSponsors.v1";
const MAX_SAVED = 50;

export type SavedSponsor = Pick<BusinessAdvert, "id" | "title" | "tagline" | "description" | "image" | "website"> & {
  savedAt: number;
};

let saved: SavedSponsor[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Reads what was saved before. Safe to call any number of times. */
export function loadSaved(): Promise<void> {
  if (!loading) {
    loading = loadItem(KEY)
      .then((stored) => {
        if (Array.isArray(stored)) {
          const known = new Set(saved.map((s) => s.id));
          saved = [...saved, ...stored.filter((s: SavedSponsor) => s && typeof s.id === "string" && !known.has(s.id))];
          notify();
        }
      })
      .catch(() => {});
  }
  return loading;
}

const persist = () => saveItem(KEY, saved);

/** Keeps an advert for later. Returns false if it was already saved. */
export function saveSponsor(advert: BusinessAdvert): boolean {
  if (saved.some((s) => s.id === advert.id)) return false;
  saved = [
    {
      id: advert.id,
      title: advert.title,
      tagline: advert.tagline,
      description: advert.description,
      image: advert.image,
      website: advert.website,
      savedAt: Date.now(),
    },
    ...saved,
  ].slice(0, MAX_SAVED);
  persist();
  notify();
  return true;
}

export function removeSponsor(id: string): void {
  saved = saved.filter((s) => s.id !== id);
  persist();
  notify();
}

/** The saved sponsors, newest first, kept up to date as they change anywhere in the app. */
export function useSavedSponsors(): SavedSponsor[] {
  const [list, setList] = useState<SavedSponsor[]>(saved);

  useEffect(() => {
    const update = () => setList(saved);
    listeners.add(update);
    loadSaved().then(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return list;
}
