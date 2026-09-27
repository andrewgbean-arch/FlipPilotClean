import fs from "fs";
import { dataPath, writeJsonAtomic } from "../config/dataDir";
import { refund, spend } from "./creditStore";

/**
 * Operation Nightglass: which chapters each player has unlocked. One record per ACCOUNT, so a player's
 * place in the story follows them to a new phone.
 *
 * Chapter One is free. Every later chapter unlocks on its own 28 days after the one before it was
 * unlocked, so a new player gets a new chapter every four weeks from the day they start, whenever they
 * joined. A player who doesn't want to wait can unlock the next chapter at once for credits; the one
 * after that then follows 28 days later.
 *
 * Unlocks earned by waiting are worked out when the player's record is read, and dated to the day
 * they fell due rather than the day they were noticed, so the calendar never drifts. Like the credit
 * store, everything is synchronous: a record is read, changed and written in one step.
 */

const FILE = dataPath("nightglass.json");

export const UNLOCK_DAYS = 28;
export const UNLOCK_CREDITS = 25;
/** The season: twelve chapters. */
export const LAST_CHAPTER = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Unlock = { at: string; via: "start" | "timer" | "credits" };
type Row = { startedAt: string; unlocks: Record<string, Unlock> };
type Store = Record<string, Row>;

function load(): Store {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    // Never replace a corrupt file with an empty one: that would lock every player out of the story.
    throw new Error("nightglass.json could not be read");
  }
}
const save = (store: Store) => writeJsonAtomic(FILE, store);

export type Progress = {
  /** Chapter numbers this player may play, in order. */
  unlocked: number[];
  /** The next chapter, and when it unlocks by itself. Null once the whole season is unlocked. */
  next: { chapter: number; unlocksAt: string } | null;
  unlockCredits: number;
};

/** Brings a record up to date: creates it on first sight, and adds every chapter that has fallen due. */
function settle(store: Store, accountId: string, now: Date): { row: Row; changed: boolean } {
  let changed = false;
  let row = store[accountId];
  if (!row) {
    const at = now.toISOString();
    row = { startedAt: at, unlocks: { 1: { at, via: "start" } } };
    store[accountId] = row;
    changed = true;
  }
  for (let n = 2; n <= LAST_CHAPTER; n++) {
    if (row.unlocks[n]) continue;
    const prev = row.unlocks[n - 1];
    if (!prev) break;
    const due = Date.parse(prev.at) + UNLOCK_DAYS * DAY_MS;
    if (now.getTime() < due) break;
    row.unlocks[n] = { at: new Date(due).toISOString(), via: "timer" };
    changed = true;
  }
  return { row, changed };
}

function view(row: Row): Progress {
  const unlocked = Object.keys(row.unlocks)
    .map(Number)
    .filter((n) => n >= 1 && n <= LAST_CHAPTER)
    .sort((a, b) => a - b);
  let next: Progress["next"] = null;
  for (let n = 1; n <= LAST_CHAPTER; n++) {
    if (row.unlocks[n]) continue;
    const prev = row.unlocks[n - 1];
    next = { chapter: n, unlocksAt: new Date(Date.parse(prev.at) + UNLOCK_DAYS * DAY_MS).toISOString() };
    break;
  }
  return { unlocked, next, unlockCredits: UNLOCK_CREDITS };
}

/** A player's place in the season. Starts their calendar the first time it is asked for. */
export function progressFor(accountId: string, now = new Date()): Progress {
  const store = load();
  const { row, changed } = settle(store, accountId, now);
  if (changed) save(store);
  return view(row);
}

export type UnlockResult =
  | { ok: true; progress: Progress; charged: number; credits?: number }
  | { ok: false; error: "unlock-in-order" | "credits-required"; progress: Progress; credits?: number; needed?: number };

/**
 * Unlocks a chapter now, for credits. Only the next chapter in the story can be bought: the season is
 * played in order. Unlocking a chapter the player already has costs nothing.
 */
export function unlockWithCredits(accountId: string, chapter: number, now = new Date()): UnlockResult {
  const store = load();
  const { row } = settle(store, accountId, now);
  if (row.unlocks[chapter]) {
    save(store);
    return { ok: true, progress: view(row), charged: 0 };
  }
  const progress = view(row);
  if (progress.next?.chapter !== chapter) {
    save(store);
    return { ok: false, error: "unlock-in-order", progress };
  }
  const paid = spend(accountId, UNLOCK_CREDITS, `nightglass-chapter-${chapter}`);
  if (!paid.ok) {
    save(store);
    return { ok: false, error: "credits-required", progress, credits: paid.balance, needed: UNLOCK_CREDITS };
  }
  row.unlocks[chapter] = { at: now.toISOString(), via: "credits" };
  try {
    save(store);
  } catch (err) {
    // The chapter wasn't recorded, so the player mustn't pay for it.
    refund(accountId, UNLOCK_CREDITS, "refund");
    throw err;
  }
  return { ok: true, progress: view(row), charged: UNLOCK_CREDITS, credits: paid.balance };
}

/** What we hold for this account, for the person's own data export. */
export function nightglassFor(accountId: string): Row | null {
  return load()[accountId] ?? null;
}

/** Deleting an account deletes its place in the story too. */
export function deleteAccountNightglass(accountId: string): boolean {
  const store = load();
  if (!(accountId in store)) return false;
  delete store[accountId];
  save(store);
  return true;
}
