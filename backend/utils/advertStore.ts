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
 * Where it is shown: an advert is either "local" (people within a radius, 50
 * miles by default, of the advertiser's postcode) or "nationwide". The phone
 * sends only a rounded position with each request, used to choose adverts and
 * then forgotten; it is never stored (see routes/adverts.ts).
 *
 * Nothing is exclusive: every placement is shared, and advertisers take turns.
 * The number who can share a place is limited so each is seen often enough to be
 * worth paying for: at most 10 in the marketplace feed and 3 on the scan full
 * page in any one area at any one time (see maxSharing). A full page takes the
 * whole screen on its advertiser's turn, and turns rotate on each phone, so
 * nobody is shown the same advert on every scan. Bookings in different parts of
 * the country never count against each other.
 *
 * Only counts are kept about how an advert performed (views and taps per day).
 * Nothing about who saw it: no device id, no address, no position.
 */

const ADVERTS_PATH = path.join(__dirname, "../data/adverts.json");

export const PLACEMENTS = ["scan-full", "scan-panel", "feed", "bootfairs"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const RADIUS_OPTIONS_MILES = [10, 25, 50] as const;
export const DEFAULT_RADIUS_MILES = 50;
export const MAX_IMAGES = 3;

export type DayCount = { views: number; clicks: number };

export type AdvertReport = { deviceId: string; reason: string; details: string; at: string };

/** This many different phones reporting an advert takes it off until someone has looked. */
export const REPORTS_TO_PAUSE = 3;

/** Where a phone is, roughly. Rounded, never stored. */
export type Viewer = { lat: number; lng: number } | null;

export type Advert = {
  id: string;
  advertiser: string;
  title: string;
  tagline: string;
  description: string;
  /** "/uploads/<name>": pictures we hold, never links to someone else's server. The first is the main one. */
  images: string[];
  /** The first picture, kept for anything that only wants one. */
  image: string;
  website: string;
  placements: Placement[];
  /** Who can see it: people near the advertiser, or everyone. */
  scope: "local" | "nationwide";
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusMiles?: number;
  /** Boot Fairs only: the big banner rather than a small card. */
  featured: boolean;
  startsAt: string;
  endsAt: string;
  /** Booked and paid for is not enough: it must also have been approved. */
  approved: boolean;
  createdAt: string;
  stats: Record<string, DayCount>;
  /** What the AI made of the wording and pictures, for whoever approves it. Never approves anything itself. */
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

/** Every picture of an advert, first one first. */
export function imagesOf(ad: { image?: string; images?: string[] }): string[] {
  return Array.isArray(ad.images) && ad.images.length > 0 ? ad.images : ad.image ? [ad.image] : [];
}

/** Approved, and today falls inside the booked dates. */
export function isLive(ad: Advert, now = new Date()): boolean {
  return ad.approved && ms(ad.startsAt) <= now.getTime() && now.getTime() < ms(ad.endsAt);
}

/* ------------------------------- geography ------------------------------- */

/** Straight-line distance in miles between two points (great circle). */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // miles
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const isLocal = (ad: Advert) =>
  ad.scope === "local" && typeof ad.lat === "number" && typeof ad.lng === "number";

/**
 * Can this phone see this advert? Nationwide adverts reach everyone, including
 * phones that share no position. A local advert reaches only a phone that has
 * shared one, and only within the advert's radius. A local advert with no point
 * on the map reaches nobody, rather than everybody.
 */
export function reaches(ad: Advert, viewer: Viewer): boolean {
  if (ad.scope === "nationwide" || ad.scope === undefined) return true;
  if (!isLocal(ad) || !viewer) return false;
  return milesBetween(ad.lat!, ad.lng!, viewer.lat, viewer.lng) <= (ad.radiusMiles ?? DEFAULT_RADIUS_MILES);
}

/* ------------------------------- sharing limits ----------------------------- */

/** Placements where a limited number of advertisers share a place and take turns. */
const LIMITED: { placement: Placement; env: string; fallback: number; label: string }[] = [
  { placement: "feed", env: "MAX_FEED_ADVERTS_PER_AREA", fallback: 10, label: "The marketplace feed" },
  { placement: "scan-full", env: "MAX_FULL_PAGE_PER_AREA", fallback: 3, label: "The scan full page" },
];

/**
 * How many advertisers may share a placement in one place at one time. The feed
 * shows roughly one advert per six listings and a full page appears on some
 * scans, so too many sharing makes each too rare to be worth paying for. Change
 * a limit with its setting (MAX_FEED_ADVERTS_PER_AREA, MAX_FULL_PAGE_PER_AREA).
 */
export function maxSharing(placement: Placement): number {
  const rule = LIMITED.find((l) => l.placement === placement);
  if (!rule) return Infinity;
  const n = Number(process.env[rule.env]);
  return Number.isInteger(n) && n > 0 ? n : rule.fallback;
}

/** Points to test around a booking: its own centre, a ring and the middle of every nearby booking. */
function samplePoints(candidate: Advert, others: Advert[]): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  const centre = (a: Advert) => (isLocal(a) ? { lat: a.lat!, lng: a.lng! } : null);

  if (isLocal(candidate)) {
    const c = centre(candidate)!;
    const r = candidate.radiusMiles ?? DEFAULT_RADIUS_MILES;
    pts.push(c);
    for (const frac of [0.5, 0.95]) {
      for (let deg = 0; deg < 360; deg += 30) {
        const dLat = ((r * frac) / 69) * Math.cos((deg * Math.PI) / 180);
        const dLng = ((r * frac) / (69 * Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)))) * Math.sin((deg * Math.PI) / 180);
        pts.push({ lat: c.lat + dLat, lng: c.lng + dLng });
      }
    }
  } else {
    // Nationwide reaches everywhere: try a coarse grid over the UK.
    for (let lat = 50; lat <= 59; lat += 1) for (let lng = -6; lng <= 1.5; lng += 1.5) pts.push({ lat, lng });
  }
  for (const o of others) {
    const c = centre(o);
    if (c) pts.push(c);
  }
  return pts;
}

/**
 * Would booking this advert put more than the limit of advertisers in front of
 * the same people, at the same time, in a limited placement? Looks at the
 * moments its booking starts or another's does, and at points around the places
 * involved, so two bookings in different parts of the country never count
 * against each other and one-day bookings on different days don't add up.
 * Returns the placement that is full, how many would be sharing at the worst
 * point and the limit, or null when there is room.
 */
export function placementFull(
  candidate: Advert,
  all: Advert[]
): { placement: Placement; label: string; count: number; limit: number } | null {
  for (const rule of LIMITED) {
    if (!candidate.placements.includes(rule.placement)) continue;
    const limit = maxSharing(rule.placement);
    const others = all.filter(
      (o) =>
        o.id !== candidate.id &&
        o.placements.includes(rule.placement) &&
        ms(o.startsAt) < ms(candidate.endsAt) &&
        ms(o.endsAt) > ms(candidate.startsAt)
    );
    if (others.length < limit) continue;

    const times = [ms(candidate.startsAt), ...others.map((o) => ms(o.startsAt)).filter((t) => t > ms(candidate.startsAt))];
    let worst = 0;
    for (const p of samplePoints(candidate, others)) {
      if (!reaches(candidate, p)) continue;
      for (const t of times) {
        const here = others.filter((o) => ms(o.startsAt) <= t && t < ms(o.endsAt) && reaches(o, p)).length + 1;
        if (here > worst) worst = here;
      }
    }
    if (worst > limit) return { placement: rule.placement, label: rule.label, count: worst, limit };
  }
  return null;
}

/* ------------------------------- what to show ------------------------------ */

/** `adverts` is the full pages if any are booked near this phone (else the panels); `panels` are always the shared panels, for when a full page is being rested. */
export type ScanAdverts = { layout: "full" | "panels"; adverts: Advert[]; panels: Advert[] };
export type FeedAdverts = { adverts: Advert[] };

const liveFor = (all: Advert[], now: Date, viewer: Viewer) =>
  all.filter((a) => isLive(a, now) && reaches(a, viewer));

/**
 * What the scan-wait screen may show near this phone: any full pages booked
 * here (the app takes turns between them and rests one that has just been
 * shown) and the shared panels.
 */
export function scanAdverts(now = new Date(), all = readAdverts(), viewer: Viewer = null): ScanAdverts {
  const live = liveFor(all, now, viewer);
  const full = live.filter((a) => a.placements.includes("scan-full")).sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
  const panels = live.filter((a) => a.placements.includes("scan-panel"));
  return full.length > 0
    ? { layout: "full", adverts: full, panels }
    : { layout: "panels", adverts: panels, panels };
}

/** Everything booked for the feed right now that reaches this phone. They share it and take turns. */
export function feedAdverts(now = new Date(), all = readAdverts(), viewer: Viewer = null): FeedAdverts {
  return { adverts: liveFor(all, now, viewer).filter((a) => a.placements.includes("feed")) };
}

export function bootfairAdverts(now = new Date(), all = readAdverts(), viewer: Viewer = null): Advert[] {
  return liveFor(all, now, viewer).filter((a) => a.placements.includes("bootfairs"));
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

/**
 * What an advertiser is shown about how their advert did: how many times it
 * was shown and tapped, by day. Counts only, from what the app really reported.
 */
export function performanceReport(ad: Advert) {
  const t = totals(ad);
  const byDay = Object.keys(ad.stats)
    .sort()
    .map((day) => ({ day, views: ad.stats[day].views, taps: ad.stats[day].clicks }));
  const tapRate = t.views > 0 ? Math.round((t.clicks / t.views) * 1000) / 10 : 0;
  return {
    advertiser: ad.advertiser,
    title: ad.title,
    bookedFrom: ad.startsAt,
    bookedTo: ad.endsAt,
    area:
      ad.scope === "local"
        ? `Within ${ad.radiusMiles ?? DEFAULT_RADIUS_MILES} miles of ${ad.postcode ?? "the advertiser"}`
        : "Nationwide",
    timesShown: t.views,
    timesTapped: t.clicks,
    tapRatePercent: tapRate,
    byDay,
    summary:
      `${ad.title}: shown ${t.views} time${t.views === 1 ? "" : "s"} and tapped ${t.clicks} time${t.clicks === 1 ? "" : "s"}` +
      (t.views > 0 ? ` (${tapRate}% of showings led to a tap)` : "") +
      `. These count showings on phones, not separate people.`,
  };
}

/** What anyone may see of an advert: nothing about the booking, the money, the place or the counts. */
export function toPublicAdvert(ad: Advert) {
  const {
    advertiser, stats, approved, createdAt, startsAt, endsAt, placements,
    aiReview, reports, pausedAt, scope, postcode, lat, lng, radiusMiles, ...rest
  } = ad;
  return { ...rest, images: imagesOf(ad) };
}
