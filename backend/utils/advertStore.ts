import fs from "fs";
import path from "path";
import type { AiReview } from "./advertReview";

/**
 * Paid adverts, booked by hand by whoever runs FlipPilot.
 *
 * An advert is only ever shown when someone has really paid for it and it has
 * been approved: there is no default list and no filler. Each one is booked for
 * a period, and switches itself off when the period ends.
 *
 * Two placements are exclusive: "scan-full" (the whole scan-wait screen) and
 * "feed-sole" (every sponsored card in the marketplace feed). Only one advert
 * can hold either at a time, so two bookings for overlapping dates are refused.
 *
 * Only counts are kept about how an advert performed (views and taps per day).
 * Nothing about who saw it: no device id, no address.
 */

const ADVERTS_PATH = path.join(__dirname, "../data/adverts.json");

export const PLACEMENTS = ["scan-full", "scan-panel", "feed", "feed-sole", "bootfairs"] as const;
export type Placement = (typeof PLACEMENTS)[number];

/** Only one advert at a time can hold these, over any given dates. */
export const EXCLUSIVE_PLACEMENTS: Placement[] = ["scan-full", "feed-sole"];

export type DayCount = { views: number; clicks: number };

export type AdvertReport = { deviceId: string; reason: string; details: string; at: string };

/** This many different phones reporting an advert takes it off until someone has looked. */
export const REPORTS_TO_PAUSE = 3;

export type Advert = {
  id: string;
  advertiser: string;
  title: string;
  tagline: string;
  description: string;
  /** "/uploads/<name>": a picture we hold, never a link to someone else's server. */
  image: string;
  website: string;
  placements: Placement[];
  /** Boot Fairs only: the big banner rather than a small card. */
  featured: boolean;
  startsAt: string;
  endsAt: string;
  /** Booked and paid for is not enough: it must also have been approved. */
  approved: boolean;
  createdAt: string;
  stats: Record<string, DayCount>;
  /** What the AI made of the wording and picture, for whoever approves it. Never approves anything itself. */
  aiReview?: AiReview;
  /** Reports from people who saw it. Private to whoever runs the marketplace. */
  reports?: AdvertReport[];
  /** Set when reports took it off. Cleared when it is approved again. */
  pausedAt?: string | null;
};

function readAdverts(): Advert[] {
  if (!fs.existsSync(ADVERTS_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ADVERTS_PATH, "utf8"));
    return Array.isArray(raw) ? (raw as Advert[]) : [];
  } catch {
    // A corrupt file must not be silently saved over with an empty one.
    throw new Error("adverts.json could not be read");
  }
}

export function loadAdverts(): Advert[] {
  return readAdverts();
}

export function saveAdverts(adverts: Advert[]) {
  fs.mkdirSync(path.dirname(ADVERTS_PATH), { recursive: true });
  fs.writeFileSync(ADVERTS_PATH, JSON.stringify(adverts, null, 2));
}

const ms = (iso: string) => new Date(iso).getTime();

/** Approved, and today falls inside the booked dates. */
export function isLive(ad: Advert, now = new Date()): boolean {
  return ad.approved && ms(ad.startsAt) <= now.getTime() && now.getTime() < ms(ad.endsAt);
}

/**
 * The exclusive placement this booking would clash on, and the advert it
 * clashes with, or null when the dates are free. Dates that only touch (one
 * ends the moment the next starts) are fine.
 */
export function findClash(
  candidate: Pick<Advert, "id" | "placements" | "startsAt" | "endsAt">,
  all: Advert[]
): { placement: Placement; with: Advert } | null {
  for (const placement of EXCLUSIVE_PLACEMENTS) {
    if (!candidate.placements.includes(placement)) continue;
    for (const other of all) {
      if (other.id === candidate.id || !other.placements.includes(placement)) continue;
      if (ms(candidate.startsAt) < ms(other.endsAt) && ms(other.startsAt) < ms(candidate.endsAt)) {
        return { placement, with: other };
      }
    }
  }
  return null;
}

export type ScanAdverts = { layout: "full" | "panels"; adverts: Advert[] };
export type FeedAdverts = { sole: boolean; adverts: Advert[] };

/** One advertiser owns the whole scan-wait screen while booked; otherwise the shared panels. */
export function scanAdverts(now = new Date(), all = readAdverts()): ScanAdverts {
  const live = all.filter((a) => isLive(a, now));
  const full = live.filter((a) => a.placements.includes("scan-full")).sort((a, b) => ms(a.startsAt) - ms(b.startsAt))[0];
  if (full) return { layout: "full", adverts: [full] };
  return { layout: "panels", adverts: live.filter((a) => a.placements.includes("scan-panel")) };
}

/** A sole sponsor takes every sponsored slot in the feed; otherwise the shared ones. */
export function feedAdverts(now = new Date(), all = readAdverts()): FeedAdverts {
  const live = all.filter((a) => isLive(a, now));
  const sole = live.filter((a) => a.placements.includes("feed-sole")).sort((a, b) => ms(a.startsAt) - ms(b.startsAt))[0];
  if (sole) return { sole: true, adverts: [sole] };
  return { sole: false, adverts: live.filter((a) => a.placements.includes("feed")) };
}

export function bootfairAdverts(now = new Date(), all = readAdverts()): Advert[] {
  return all.filter((a) => isLive(a, now) && a.placements.includes("bootfairs"));
}

/** Counts a view or a tap against today, if the advert is live. False when it isn't. */
export function recordEvent(id: string, type: "view" | "click", now = new Date()): boolean {
  const all = readAdverts();
  const ad = all.find((a) => a.id === id);
  if (!ad || !isLive(ad, now)) return false;
  const day = now.toISOString().slice(0, 10);
  const counts = ad.stats[day] ?? { views: 0, clicks: 0 };
  if (type === "view") counts.views += 1;
  else counts.clicks += 1;
  ad.stats[day] = counts;
  saveAdverts(all);
  return true;
}

/**
 * Files a report from one phone (a second report from the same phone replaces
 * its first). Enough different phones and the advert is taken off: unapproved
 * until a person has looked. Returns whether it was taken off, or null if there
 * is no such live advert.
 */
export function addAdvertReport(
  id: string,
  report: AdvertReport,
  now = new Date()
): { paused: boolean } | null {
  const all = readAdverts();
  const ad = all.find((a) => a.id === id);
  if (!ad || !isLive(ad, now)) return null;

  const reports = (ad.reports ?? []).filter((r) => r.deviceId !== report.deviceId);
  reports.push(report);
  ad.reports = reports.slice(-50);

  let paused = false;
  if (new Set(ad.reports.map((r) => r.deviceId)).size >= REPORTS_TO_PAUSE) {
    ad.approved = false;
    ad.pausedAt = now.toISOString();
    paused = true;
  }
  saveAdverts(all);
  return { paused };
}

export function totals(ad: Advert): DayCount {
  return Object.values(ad.stats).reduce(
    (sum, d) => ({ views: sum.views + d.views, clicks: sum.clicks + d.clicks }),
    { views: 0, clicks: 0 }
  );
}

/** What anyone may see of an advert: nothing about the booking, the money or the counts. */
export function toPublicAdvert(ad: Advert) {
  const { advertiser, stats, approved, createdAt, startsAt, endsAt, placements, aiReview, reports, pausedAt, ...rest } = ad;
  return rest;
}
