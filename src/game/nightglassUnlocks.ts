import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { fetchScanAllowance } from "@/lib/credits";
import { API_CONFIGURED, BASE_URL } from "@/utils/api";
import type { Chapter } from "./nightglass";

/**
 * A player's place in the Nightglass season, kept by the server against their FlipPilot account
 * (backend/utils/nightglassStore.ts). Chapter One is free. Each later chapter unlocks by itself four
 * weeks after the one before, counted from the day the player starts, or at once for credits.
 *
 * This sits on top of a chapter's release: a chapter still marked "coming soon" in CHAPTERS stays
 * locked for everybody, whatever the player has unlocked.
 */
export type SeasonProgress =
  | { signedIn: false }
  | { signedIn: true; unlocked: number[]; next: { chapter: number; unlocksAt: string } | null; unlockCredits: number };

function parse(json: any): SeasonProgress | null {
  if (!json?.ok) return null;
  if (!json.signedIn) return { signedIn: false };
  return {
    signedIn: true,
    unlocked: Array.isArray(json.unlocked) ? json.unlocked.map(Number) : [1],
    next: json.next ? { chapter: Number(json.next.chapter), unlocksAt: String(json.next.unlocksAt) } : null,
    unlockCredits: Number(json.unlockCredits) || 25,
  };
}

/** The player's progress, or null when the server can't be reached. */
export async function fetchProgress(): Promise<SeasonProgress | null> {
  if (!API_CONFIGURED) return null;
  try {
    const res = await fetch(`${BASE_URL}/games/nightglass/progress`);
    return parse(await res.json());
  } catch {
    return null;
  }
}

export class UnlockError extends Error {
  constructor(message: string, readonly code?: string, readonly credits?: number, readonly needed?: number) {
    super(message);
  }
}

/** Unlocks the next chapter now, for credits. */
export async function unlockChapter(chapter: number): Promise<SeasonProgress> {
  let json: any = null;
  try {
    const res = await fetch(`${BASE_URL}/games/nightglass/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter }),
    });
    json = await res.json().catch(() => null);
  } catch {
    throw new UnlockError("Couldn't reach FlipPilot. Check your connection and try again.");
  }
  const progress = json?.ok ? parse(json) : null;
  if (!progress) throw new UnlockError(json?.message ?? "Couldn't unlock the chapter. Please try again.", json?.error, json?.credits, json?.needed);
  return progress;
}

/** Is this chapter unlocked for the player? Chapter One always is. */
export function isUnlocked(progress: SeasonProgress | null, id: number): boolean {
  return id === 1 || (!!progress?.signedIn && progress.unlocked.includes(id));
}

/** "in 12 days, on 3 March" */
export function whenUnlocks(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  const date = new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return `in ${days} ${days === 1 ? "day" : "days"}, on ${date}`;
}

/** The progress as a screen needs it, fetched again whenever the screen comes into view. */
export function useSeasonProgress() {
  const [progress, setProgress] = useState<SeasonProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(() => {
    fetchProgress()
      .then((p) => {
        if (p) setProgress(p);
      })
      .finally(() => setLoaded(true));
  }, []);
  useFocusEffect(refresh);
  return { progress, loaded, refresh, setProgress };
}

/** Alert.alert does nothing in the web build, so the browser's own dialogs stand in there. */
function ask(title: string, message: string, yes: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: yes, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  );
}

/**
 * Asks the player to confirm, spends the credits and unlocks the chapter. Sends them to buy credits,
 * or to sign in, if that is what is missing. Resolves with the new progress once it is unlocked.
 */
export async function confirmUnlock(ch: Chapter, cost: number): Promise<SeasonProgress | null> {
  const balance = (await fetchScanAllowance())?.credits;
  const ok = await ask(
    `Unlock Chapter ${ch.number} now?`,
    `${ch.place} unlocks straight away for ${cost} credits.${balance !== undefined ? ` You have ${balance}.` : ""} The chapter after it then follows four weeks later.`,
    `Unlock for ${cost} credits`
  );
  if (!ok) return null;
  try {
    return await unlockChapter(ch.id);
  } catch (err) {
    const e = err instanceof UnlockError ? err : new UnlockError("Couldn't unlock the chapter. Please try again.");
    if (e.code === "credits-required") {
      const buy = await ask("Not enough credits", `Unlocking Chapter ${ch.number} now takes ${cost} credits.${e.credits !== undefined ? ` You have ${e.credits}.` : ""}`, "Get credits");
      if (buy) router.push("/credits");
    } else if (e.code !== "sign-in-required") {
      // A sign-in is already being asked for by the app itself (src/lib/account.ts).
      if (Platform.OS === "web") window.alert(e.message);
      else Alert.alert("Couldn't unlock it", e.message);
    }
    return null;
  }
}
