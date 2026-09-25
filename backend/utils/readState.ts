import fs from "fs";
import path from "path";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/**
 * What each device has looked at, so the app can tell a conversation with
 * something new in it from one already read, and flash Home when there is.
 *
 * Per device: when it last opened the inbox, and when it last opened each chat.
 * A chat is read whenever its own messages are fetched by one of its two people
 * (see routes/messages.ts), so nothing extra has to be sent from the phone.
 */

const FILE = dataPath("reads.json");

type Entry = { inboxSeenAt?: string; chats: Record<string, string> };
type Store = Record<string, Entry>;

function load(): Store {
  if (!fs.existsSync(FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Read receipts are not worth failing a request over, and are safe to rebuild.
    return {};
  }
}

function save(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  writeJsonAtomic(FILE, store);
}

export const chatKey = (listingId: string | number, threadId: string) => `${listingId}:${threadId}`;

export function readEntry(deviceId: string): Entry {
  const found = load()[deviceId];
  return { inboxSeenAt: found?.inboxSeenAt, chats: found?.chats ?? {} };
}

export function markChatRead(deviceId: string, key: string, when = new Date()) {
  const store = load();
  const entry = store[deviceId] ?? { chats: {} };
  entry.chats = entry.chats ?? {};
  entry.chats[key] = when.toISOString();
  store[deviceId] = entry;
  save(store);
}

export function markInboxSeen(deviceId: string, when = new Date()) {
  const store = load();
  const entry = store[deviceId] ?? { chats: {} };
  entry.chats = entry.chats ?? {};
  entry.inboxSeenAt = when.toISOString();
  store[deviceId] = entry;
  save(store);
}

export function removeReadsFor(deviceId: string): boolean {
  const store = load();
  if (!(deviceId in store)) return false;
  delete store[deviceId];
  save(store);
  return true;
}

/** Forgets chats not opened since `before`, and devices left with nothing. */
export function pruneReads(before: Date): number {
  const store = load();
  let removed = 0;
  for (const [deviceId, entry] of Object.entries(store)) {
    for (const [key, at] of Object.entries(entry.chats ?? {})) {
      if (Date.parse(at) < before.getTime()) {
        delete entry.chats[key];
        removed++;
      }
    }
    const seen = entry.inboxSeenAt ? Date.parse(entry.inboxSeenAt) : 0;
    if (Object.keys(entry.chats ?? {}).length === 0 && seen < before.getTime()) {
      delete store[deviceId];
    }
  }
  if (removed > 0) save(store);
  return removed;
}
