import fs from "fs";
import crypto from "crypto";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/**
 * What people tell us through the app's Feedback box and star rating. Written by the person, about
 * the app; it can contain anything they choose to type, so it is treated as personal data: included
 * in "download my data", removed outright (not just anonymised) when they delete their data, and
 * dropped after the same period as other reports. Read by whoever runs FlipPilot at /admin/feedback,
 * which never shows the device id.
 */

const FEEDBACK_PATH = dataPath("feedback.json");

export const FEEDBACK_MAX_CHARS = 2000;
/** Per phone per day, so one phone can't fill the file. */
export const FEEDBACK_PER_DAY = 10;
/** Everything kept, oldest dropped first. */
export const FEEDBACK_MAX_KEPT = 5000;

export type FeedbackItem = {
  id: string;
  deviceId: string;
  kind: "feedback" | "rating";
  /** 1 to 5, for a rating. */
  rating: number | null;
  text: string;
  at: string;
};

function load(): FeedbackItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FEEDBACK_PATH, "utf8"));
    return Array.isArray(raw?.items) ? raw.items : [];
  } catch {
    return [];
  }
}

const save = (items: FeedbackItem[]) => writeJsonAtomic(FEEDBACK_PATH, { items });

export type AddResult = { ok: true; id: string } | { ok: false; reason: "too-many" };

export function addFeedback(
  deviceId: string,
  entry: { kind: "feedback" | "rating"; rating: number | null; text: string },
  now = Date.now()
): AddResult {
  const items = load();
  const dayAgo = now - 24 * 3_600_000;
  const recent = items.filter((i) => i.deviceId === deviceId && Date.parse(i.at) > dayAgo).length;
  if (recent >= FEEDBACK_PER_DAY) return { ok: false, reason: "too-many" };

  const item: FeedbackItem = {
    id: crypto.randomBytes(6).toString("hex"),
    deviceId,
    kind: entry.kind,
    rating: entry.rating,
    text: entry.text,
    at: new Date(now).toISOString(),
  };
  items.push(item);
  save(items.length > FEEDBACK_MAX_KEPT ? items.slice(items.length - FEEDBACK_MAX_KEPT) : items);
  return { ok: true, id: item.id };
}

export const feedbackBy = (deviceId: string) =>
  load()
    .filter((i) => i.deviceId === deviceId)
    .map(({ kind, rating, text, at }) => ({ kind, rating, text, at }));

export function deleteFeedbackBy(deviceId: string): number {
  const items = load();
  const kept = items.filter((i) => i.deviceId !== deviceId);
  if (kept.length !== items.length) save(kept);
  return items.length - kept.length;
}

export function purgeFeedbackBefore(cutoff: Date): number {
  const items = load();
  const kept = items.filter((i) => Date.parse(i.at) >= cutoff.getTime());
  if (kept.length !== items.length) save(kept);
  return items.length - kept.length;
}

/** For the person running FlipPilot: newest first, with no device id (only a short fingerprint to tell phones apart). */
export function feedbackReport(days: number, now = Date.now()) {
  const since = now - days * 24 * 3_600_000;
  const items = load()
    .filter((i) => Date.parse(i.at) >= since)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const ratings = items.filter((i) => i.kind === "rating" && i.rating != null);
  return {
    days,
    ratingCount: ratings.length,
    averageRating: ratings.length ? Math.round((ratings.reduce((s, i) => s + (i.rating ?? 0), 0) / ratings.length) * 10) / 10 : null,
    items: items.map((i) => ({
      at: i.at,
      kind: i.kind,
      rating: i.rating,
      text: i.text,
      from: crypto.createHash("sha256").update(i.deviceId).digest("hex").slice(0, 6),
    })),
  };
}
