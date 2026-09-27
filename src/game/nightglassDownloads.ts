import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";

import { API_CONFIGURED, BASE_URL } from "@/utils/api";
import type { Chapter } from "./nightglass";

/**
 * Downloaded Nightglass chapters. Every chapter after the first is fetched from the FlipPilot server
 * when the player asks for it and kept in the app's documents folder, so it plays offline from then on
 * and the app itself stays small. The player can delete a chapter to free the space and download it
 * again later.
 *
 * A chapter is always kept at the same path (nightglass/chapter<N>.html): the game saves progress in
 * the page's own storage, which belongs to that address, so deleting and downloading a chapter again,
 * or updating it to a new version, keeps the player's progress.
 */
const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}nightglass/` : null;
const META = DIR ? `${DIR}downloads.json` : null;

/** Downloads need a phone (not the web build) and a server to fetch from. */
export const DOWNLOADS_AVAILABLE = Platform.OS !== "web" && !!DIR && API_CONFIGURED;

export const chapterFile = (id: number): string | null => (DIR ? `${DIR}chapter${id}.html` : null);

/** Where the server keeps a chapter. The version is part of the address, so no cache serves an old copy. */
export const chapterUrl = (ch: Chapter): string => `${BASE_URL}/games/nightglass/chapter${ch.id}.html?v=${ch.download?.version ?? 1}`;

/** Chapter id -> the version on this phone. */
type Versions = Record<number, number>;

async function readMeta(): Promise<Versions> {
  if (!META) return {};
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(META));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMeta(v: Versions): Promise<void> {
  if (META) await FileSystem.writeAsStringAsync(META, JSON.stringify(v));
}

/** The chapters on this phone, and at which version. A file that has gone missing doesn't count. */
export async function downloadedVersions(): Promise<Versions> {
  if (!DIR) return {};
  const meta = await readMeta();
  const out: Versions = {};
  for (const [id, version] of Object.entries(meta)) {
    const file = chapterFile(Number(id));
    if (file && (await FileSystem.getInfoAsync(file)).exists) out[Number(id)] = Number(version);
  }
  return out;
}

export async function isDownloaded(id: number): Promise<boolean> {
  return (await downloadedVersions())[id] !== undefined;
}

/** Downloads a chapter, reporting progress from 0 to 1. Throws an Error whose message can be shown. */
export async function downloadChapter(ch: Chapter, onProgress: (fraction: number) => void): Promise<void> {
  const dest = chapterFile(ch.id);
  if (!DOWNLOADS_AVAILABLE || !DIR || !dest || !ch.download) throw new Error("Chapters can't be downloaded in this version of the app.");
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);

  const free = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.POSITIVE_INFINITY);
  if (free < ch.download.mb * 1_000_000 * 1.5 + 20_000_000) {
    throw new Error(`There isn't enough space on this phone. Chapter ${ch.number} needs about ${ch.download.mb} MB.`);
  }

  // Download beside the real file and only swap it in once it is complete, so a dropped connection
  // never leaves half a chapter where a whole one should be.
  const part = `${DIR}chapter${ch.id}.part`;
  await FileSystem.deleteAsync(part, { idempotent: true });
  const task = FileSystem.createDownloadResumable(chapterUrl(ch), part, {}, (d) => {
    if (d.totalBytesExpectedToWrite > 0) onProgress(Math.min(1, d.totalBytesWritten / d.totalBytesExpectedToWrite));
  });
  let result: FileSystem.FileSystemDownloadResult | undefined;
  try {
    result = await task.downloadAsync();
  } catch {
    await FileSystem.deleteAsync(part, { idempotent: true });
    throw new Error("The download didn't finish. Check your connection and try again.");
  }
  if (!result || result.status !== 200) {
    await FileSystem.deleteAsync(part, { idempotent: true });
    throw new Error("This chapter isn't available to download just now. Please try again later.");
  }
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: part, to: dest });
  const meta = await readMeta();
  meta[ch.id] = ch.download.version;
  await writeMeta(meta);
  onProgress(1);
}

/** Removes a downloaded chapter from the phone. The player's progress is kept. */
export async function deleteChapter(id: number): Promise<void> {
  const file = chapterFile(id);
  if (file) await FileSystem.deleteAsync(file, { idempotent: true });
  const meta = await readMeta();
  delete meta[id];
  await writeMeta(meta);
}

/**
 * The downloads as the chapter list needs them: what is on the phone, what is downloading and how far
 * along, and the last problem for each chapter. Refreshes whenever the screen comes into view.
 */
export function useChapterDownloads() {
  const [versions, setVersions] = useState<Versions>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const busy = useRef(new Set<number>());

  const refresh = useCallback(() => {
    downloadedVersions()
      .then(setVersions)
      .catch(() => undefined);
  }, []);
  useFocusEffect(refresh);

  const download = useCallback(
    async (ch: Chapter) => {
      if (busy.current.has(ch.id)) return;
      busy.current.add(ch.id);
      setErrors((e) => ({ ...e, [ch.id]: "" }));
      setProgress((p) => ({ ...p, [ch.id]: 0 }));
      try {
        await downloadChapter(ch, (f) => setProgress((p) => ({ ...p, [ch.id]: f })));
      } catch (err) {
        setErrors((e) => ({ ...e, [ch.id]: err instanceof Error ? err.message : "The download failed." }));
      } finally {
        busy.current.delete(ch.id);
        setProgress((p) => {
          const next = { ...p };
          delete next[ch.id];
          return next;
        });
        refresh();
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (ch: Chapter) => {
      await deleteChapter(ch.id).catch(() => undefined);
      refresh();
    },
    [refresh]
  );

  return { versions, progress, errors, download, remove };
}
