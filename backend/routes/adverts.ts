import crypto from "crypto";
import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import {
  Advert,
  DEFAULT_RADIUS_MILES,
  MAX_IMAGES,
  PLACEMENTS,
  Placement,
  RADIUS_OPTIONS_MILES,
  Viewer,
  addAdvertReport,
  bootfairAdverts,
  feedAdverts,
  placementFull,
  imagesOf,
  loadAdverts,
  performanceReport,
  recordEvent,
  saveAdverts,
  scanAdverts,
  toPublicAdvert,
  totals,
} from "../utils/advertStore";
import { adminOk } from "../utils/adminAuth";
import { checkAdvert, blocking } from "../utils/advertCheck";
import { reviewAdvert } from "../utils/advertReview";
import { cleanPostcode, geocodePostcode, looksLikeUkPoint } from "../utils/geocode";
import { mediaForAdvert } from "../utils/media";
import { deleteUploads, saveUpload, sniffImage } from "../utils/uploadStore";
import { callerDeviceId } from "./messages";
import { REPORT_REASONS } from "./safety";

/**
 * Adverts.
 *
 * The public side only ever returns what is booked, approved, in date and
 * within reach of the phone asking, so an advert that has ended, was never
 * approved, or is for another part of the country simply isn't there.
 *
 * Where a phone is: it may send a rounded position in the x-approx-location
 * header ("lat,lng"). It is used to pick adverts for that one request and is
 * never stored or logged (a header, not the address, so the request log does not
 * carry it). A phone that sends none is only shown nationwide adverts.
 *
 * The admin side is for whoever runs FlipPilot: off unless ADMIN_TOKEN is set,
 * and then it needs that token in the x-admin-token header. Every advert goes
 * through three checks on the way to being live:
 *   1. wording and link rules (swearing is always refused; scam wording and
 *      dodgy links are refused unless the approver says they have looked),
 *   2. an AI look at the wording and pictures, saved with the advert,
 *   3. a person approving it. Nothing else can approve an advert.
 * And once live, enough different people reporting it takes it off again.
 */

// A "system:" owner can never be a phone (see uploadStore), so no request can name it to list or delete these.
const IMAGE_OWNER = "system:advert-images";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
};

/** https only, with a real host and no embedded login. */
function cleanWebsite(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 300) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Where the phone says it is, rounded to about a mile. Nothing is kept. */
function parseViewer(req: Request): Viewer {
  const raw = req.headers["x-approx-location"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = typeof value === "string" ? value.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/) : null;
  if (!m) return null;
  const lat = Math.round(Number(m[1]) * 100) / 100;
  const lng = Math.round(Number(m[2]) * 100) / 100;
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

/** Saves one picture sent as base64, judged by its own bytes. */
function storeImage(raw: unknown): { path: string } | { error: string } {
  const encoded = typeof raw === "string" ? raw.replace(/^data:image\/[a-z+]+;base64,/i, "") : "";
  if (encoded.length < 100) return { error: "No picture received" };
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length > MAX_IMAGE_BYTES) return { error: "That picture is too large" };
  const type = sniffImage(buffer);
  if (!type) return { error: "Only JPEG, PNG or WebP pictures are allowed" };
  return { path: saveUpload(IMAGE_OWNER, buffer, type) };
}

/** Saves up to MAX_IMAGES pictures; if any is bad, none are kept. */
function storeImages(raw: unknown): { paths: string[] } | { error: string } {
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  if (list.length === 0) return { error: "No picture received" };
  if (list.length > MAX_IMAGES) return { error: `An advert can have at most ${MAX_IMAGES} pictures` };
  const paths: string[] = [];
  for (const item of list) {
    const one = storeImage(item);
    if ("error" in one) {
      deleteUploads(paths);
      return { error: one.error };
    }
    paths.push(one.path);
  }
  return { paths };
}

type Area = Pick<Advert, "scope" | "postcode" | "lat" | "lng" | "radiusMiles">;

/**
 * Works out where an advert is for from what the booking says. "local" needs a
 * point on the map, from a postcode (looked up once, then only the point is
 * kept) or given directly; "nationwide" needs nothing. Anything unclear is
 * refused rather than guessed, since a wrong area shows an advert to the wrong
 * people.
 */
async function resolveArea(b: any, current?: Advert): Promise<{ area: Area } | { error: string }> {
  const scope = b.scope ?? current?.scope;
  if (scope !== "local" && scope !== "nationwide") {
    return { error: 'scope must be "local" (people near the advertiser) or "nationwide"' };
  }
  if (scope === "nationwide") {
    return { area: { scope, postcode: null, lat: null, lng: null, radiusMiles: DEFAULT_RADIUS_MILES } };
  }

  const radius = b.radiusMiles ?? current?.radiusMiles ?? DEFAULT_RADIUS_MILES;
  if (!(RADIUS_OPTIONS_MILES as readonly number[]).includes(radius)) {
    return { error: `radiusMiles must be one of: ${RADIUS_OPTIONS_MILES.join(", ")}` };
  }

  // The same place as before, unless a new postcode or point is given.
  const changingPlace = b.postcode !== undefined || b.lat !== undefined || b.lng !== undefined;
  if (!changingPlace && current?.scope === "local" && typeof current.lat === "number") {
    return { area: { scope, postcode: current.postcode ?? null, lat: current.lat, lng: current.lng ?? null, radiusMiles: radius } };
  }

  const postcode = b.postcode === undefined ? null : cleanPostcode(b.postcode);
  if (b.postcode !== undefined && !postcode) return { error: "That does not look like a UK postcode" };

  if (b.lat !== undefined || b.lng !== undefined) {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!looksLikeUkPoint(lat, lng)) return { error: "lat and lng must be a point in the UK" };
    return { area: { scope, postcode, lat, lng, radiusMiles: radius } };
  }
  if (!postcode) return { error: "A local advert needs a postcode (or lat and lng) for where the advertiser is" };

  const point = await geocodePostcode(postcode);
  if (!point || !looksLikeUkPoint(point.lat, point.lng)) {
    return { error: `We could not find ${postcode} on the map. Check it, or give lat and lng.` };
  }
  return { area: { scope, postcode, lat: point.lat, lng: point.lng, radiusMiles: radius } };
}

function stateOf(ad: Advert, now = new Date()): string {
  if (ad.pausedAt && !ad.approved) return "paused-by-reports";
  if (!ad.approved) return "awaiting-approval";
  if (now.getTime() >= new Date(ad.endsAt).getTime()) return "ended";
  if (now.getTime() < new Date(ad.startsAt).getTime()) return "scheduled";
  return "live";
}

function forAdmin(ad: Advert, req: Request) {
  const state = stateOf(ad);
  return {
    ...mediaForAdvert({ ...ad, images: imagesOf(ad) }, req),
    totals: totals(ad),
    state,
    // Something a person has to look at: not approved yet (or taken off), and not already over.
    needsAttention: !ad.approved && new Date(ad.endsAt).getTime() > Date.now(),
    reportCount: new Set((ad.reports ?? []).map((r) => r.deviceId)).size,
  };
}

function fullReply(res: Response, full: NonNullable<ReturnType<typeof placementFull>>) {
  return res.status(409).json({
    ok: false,
    error: "placement-full",
    message: `${full.label} already has ${full.limit} advertisers sharing that area over those dates, so this would make ${full.count}. Choose other dates, another area or another placement.`,
  });
}

/** Async admin handlers: an error inside one (a corrupt file, a failed write) is a 500, not a dead server. */
const safe =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("advert route failed:", err?.message ?? err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Something went wrong" });
    });
  };

function contentReply(res: Response, problems: ReturnType<typeof checkAdvert>) {
  return res.status(422).json({
    ok: false,
    error: "advert-content",
    message: "This advert was not saved: " + problems.map((p) => p.message).join("; ") + ".",
    problems,
    // Swearing can never be waved through. The rest can, by someone who has looked: send reviewed: true.
    canOverride: problems.every((p) => p.kind !== "language"),
  });
}

export default function registerAdvertsRoute(app: Express) {
  /* ---------------- public ---------------- */

  app.get("/adverts", rateLimit(120), (req: Request, res: Response) => {
    const placement = String(req.query.placement ?? "");
    const viewer = parseViewer(req);
    const shape = (ads: Advert[]) => ads.map((a) => mediaForAdvert(toPublicAdvert(a), req));

    // Depends on who asks (where they are), so nothing may be shared between people.
    res.setHeader("Cache-Control", "private, no-store");
    if (placement === "scan") {
      const s = scanAdverts(undefined, undefined, viewer);
      return res.json({ ok: true, layout: s.layout, adverts: shape(s.adverts), panels: shape(s.panels) });
    }
    if (placement === "feed") {
      const f = feedAdverts(undefined, undefined, viewer);
      return res.json({ ok: true, adverts: shape(f.adverts) });
    }
    if (placement === "bootfairs") {
      return res.json({ ok: true, adverts: shape(bootfairAdverts(undefined, undefined, viewer)) });
    }
    return res.status(400).json({ ok: false, error: "Unknown placement" });
  });

  // A view or a tap. Counts only: who did it is never recorded.
  app.post("/adverts/:id/event", rateLimit(240), (req: Request, res: Response) => {
    const type = req.body?.type;
    if (type !== "view" && type !== "click" && type !== "save") {
      return res.status(400).json({ ok: false, error: "Unknown event" });
    }
    res.json({ ok: true, counted: recordEvent(String(req.params.id), type) });
  });

  // "Report this advert". Private: the advertiser is never told who reported.
  app.post("/adverts/:id/report", rateLimit(10), (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    const reason = String(req.body?.reason ?? "");
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      return res.status(400).json({ ok: false, error: "Pick a reason for the report" });
    }
    const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 500) : "";

    const filed = addAdvertReport(String(req.params.id), {
      deviceId: caller,
      reason,
      details,
      at: new Date().toISOString(),
    });
    if (!filed) return res.status(404).json({ ok: false, error: "That advert isn't showing any more" });
    res.json({ ok: true });
  });

  /* ---------------- admin ---------------- */

  app.get("/admin/adverts", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    let ads = loadAdverts().map((a) => forAdmin(a, req));
    // ?needs=attention: just what is waiting for a person to look at it.
    if (req.query.needs === "attention") ads = ads.filter((a) => a.needsAttention);
    res.json({ ok: true, adverts: ads });
  });

  // What to tell the advertiser about how their advert did.
  app.get("/admin/adverts/:id/report", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const ad = loadAdverts().find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    res.json({ ok: true, report: performanceReport(ad) });
  });

  app.post("/admin/adverts", safe(async (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const b = req.body ?? {};

    const advertiser = text(b.advertiser, 80);
    const title = text(b.title, 80);
    const website = cleanWebsite(b.website);
    const startsAt = cleanDate(b.startsAt);
    const endsAt = cleanDate(b.endsAt);
    const given: unknown[] = Array.isArray(b.placements) ? [...new Set<unknown>(b.placements)] : [];
    const placements = given.filter((p): p is Placement => PLACEMENTS.includes(p as Placement));

    if (!advertiser) return res.status(400).json({ ok: false, error: "advertiser is required (80 characters at most)" });
    if (!title) return res.status(400).json({ ok: false, error: "title is required (80 characters at most)" });
    if (!website) return res.status(400).json({ ok: false, error: "website must be an https address" });
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      return res.status(400).json({ ok: false, error: "startsAt and endsAt must be dates, with the end after the start" });
    }
    if (placements.length === 0 || placements.length !== given.length) {
      return res.status(400).json({ ok: false, error: `placements must be some of: ${PLACEMENTS.join(", ")}` });
    }
    const tagline = b.tagline === undefined || b.tagline === "" ? "" : text(b.tagline, 120);
    const description = b.description === undefined || b.description === "" ? "" : text(b.description, 300);
    if (tagline === null) return res.status(400).json({ ok: false, error: "tagline is too long (120 characters at most)" });
    if (description === null) return res.status(400).json({ ok: false, error: "description is too long (300 characters at most)" });

    const where = await resolveArea(b);
    if ("error" in where) return res.status(400).json({ ok: false, error: where.error });

    const advert: Advert = {
      id: crypto.randomBytes(8).toString("hex"),
      advertiser,
      title,
      tagline,
      description,
      images: [],
      image: "",
      website,
      placements,
      ...where.area,
      featured: b.featured === true,
      startsAt,
      endsAt,
      approved: false,
      createdAt: new Date().toISOString(),
      stats: {},
      reports: [],
      pausedAt: null,
    };

    const full = placementFull(advert, loadAdverts());
    if (full) return fullReply(res, full);

    // Rude or scammy wording is stopped before anything is saved.
    const problems = blocking(checkAdvert(advert), b.reviewed === true);
    if (problems.length > 0) return contentReply(res, problems);

    const stored = storeImages(b.imagesBase64 ?? b.imageBase64);
    if ("error" in stored) return res.status(400).json({ ok: false, error: stored.error });
    advert.images = stored.paths;
    advert.image = stored.paths[0];

    advert.aiReview = await reviewAdvert(advert);

    // Asking for it to be approved only sticks when the AI found nothing to look at.
    // Otherwise it waits for a person, using the PATCH route, having read the AI's reasons.
    const wantsApproval = b.approved === true;
    advert.approved = wantsApproval && advert.aiReview.verdict === "ok";

    saveAdverts([...loadAdverts(), advert]);
    res.json({
      ok: true,
      advert: forAdmin(advert, req),
      ...(wantsApproval && !advert.approved
        ? { note: `Saved, but not approved: the AI check said "${advert.aiReview.verdict}". Read its reasons, then approve it yourself if you are happy.` }
        : {}),
    });
  }));

  app.patch("/admin/adverts/:id", safe(async (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    const b = req.body ?? {};
    const next: Advert = { ...ad, images: imagesOf(ad) };

    for (const [key, max] of [["advertiser", 80], ["title", 80]] as const) {
      if (b[key] !== undefined) {
        const v = text(b[key], max);
        if (!v) return res.status(400).json({ ok: false, error: `${key} is invalid` });
        next[key] = v;
      }
    }
    for (const [key, max] of [["tagline", 120], ["description", 300]] as const) {
      if (b[key] !== undefined) {
        const v = b[key] === "" ? "" : text(b[key], max);
        if (v === null) return res.status(400).json({ ok: false, error: `${key} is invalid` });
        next[key] = v;
      }
    }
    if (b.website !== undefined) {
      const v = cleanWebsite(b.website);
      if (!v) return res.status(400).json({ ok: false, error: "website must be an https address" });
      next.website = v;
    }
    if (b.startsAt !== undefined) {
      const v = cleanDate(b.startsAt);
      if (!v) return res.status(400).json({ ok: false, error: "startsAt is invalid" });
      next.startsAt = v;
    }
    if (b.endsAt !== undefined) {
      const v = cleanDate(b.endsAt);
      if (!v) return res.status(400).json({ ok: false, error: "endsAt is invalid" });
      next.endsAt = v;
    }
    if (new Date(next.endsAt) <= new Date(next.startsAt)) {
      return res.status(400).json({ ok: false, error: "The end must be after the start" });
    }
    if (b.placements !== undefined) {
      const list: unknown[] = Array.isArray(b.placements) ? [...new Set<unknown>(b.placements)] : [];
      if (list.length === 0 || !list.every((p) => PLACEMENTS.includes(p as Placement))) {
        return res.status(400).json({ ok: false, error: `placements must be some of: ${PLACEMENTS.join(", ")}` });
      }
      next.placements = list as Placement[];
    }
    if (b.featured !== undefined) next.featured = b.featured === true;

    if (["scope", "postcode", "lat", "lng", "radiusMiles"].some((k) => b[k] !== undefined)) {
      const where = await resolveArea(b, ad);
      if ("error" in where) return res.status(400).json({ ok: false, error: where.error });
      Object.assign(next, where.area);
    }

    // Only re-checked when where or when it shows changed: retitling or un-approving an advert in
    // an area that is already full must still be possible.
    const showsSame =
      JSON.stringify([next.placements, next.startsAt, next.endsAt, next.scope, next.lat, next.lng, next.radiusMiles]) ===
      JSON.stringify([ad.placements, ad.startsAt, ad.endsAt, ad.scope, ad.lat, ad.lng, ad.radiusMiles]);
    const full = showsSame ? null : placementFull(next, all);
    if (full) return fullReply(res, full);

    const wordingChanged = (["advertiser", "title", "tagline", "description", "website"] as const).some(
      (k) => next[k] !== ad[k]
    );
    const approving = b.approved === true && !ad.approved;
    if (b.approved === false) next.approved = false;

    // Changed wording is checked again, and so is anything about to go live.
    if (wordingChanged || approving) {
      const problems = blocking(checkAdvert(next), b.reviewed === true);
      if (problems.length > 0) return contentReply(res, problems);
    }

    let oldImages: string[] = [];
    const newPictures = b.imagesBase64 ?? b.imageBase64;
    if (newPictures !== undefined) {
      const stored = storeImages(newPictures);
      if ("error" in stored) return res.status(400).json({ ok: false, error: stored.error });
      oldImages = imagesOf(ad);
      next.images = stored.paths;
      next.image = stored.paths[0];
    }

    // Different words or pictures, or never looked at (an older record): the AI looks again.
    if (wordingChanged || oldImages.length > 0 || !ad.aiReview) {
      next.aiReview = await reviewAdvert(next);
    }

    if (approving) {
      if (next.aiReview?.verdict === "reject" && b.reviewed !== true) {
        if (oldImages.length > 0) deleteUploads(next.images);
        return res.status(422).json({
          ok: false,
          error: "ai-rejected",
          message: "The AI check says this looks like a scam or is not suitable. Read its reasons; if you have looked and are sure, send reviewed: true.",
          aiReview: next.aiReview,
        });
      }
      next.approved = true;
      next.pausedAt = null;
      // Old reports were about what was there before someone looked again.
      next.reports = [];
    }

    // The postcode and AI lookups above take seconds. Anything that changed meanwhile (a report, a
    // view count, a delete) must not be overwritten by the copy read before them, so read again and
    // apply only what THIS request changed.
    const latest = loadAdverts();
    const current = latest.find((a) => a.id === ad.id);
    if (!current) {
      deleteUploads(next.images.filter((p) => !imagesOf(ad).includes(p)));
      return res.status(404).json({ ok: false, error: "No such advert" });
    }
    const merged: Advert = { ...current };
    for (const key of Object.keys(next) as (keyof Advert)[]) {
      if (JSON.stringify(next[key]) !== JSON.stringify(ad[key])) (merged as any)[key] = next[key];
    }
    saveAdverts(latest.map((a) => (a.id === ad.id ? merged : a)));
    if (oldImages.length > 0) deleteUploads(oldImages);
    res.json({ ok: true, advert: forAdmin(merged, req) });
  }));

  // Run the AI check again, for example after switching the key on.
  app.post("/admin/adverts/:id/review", safe(async (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    const review = await reviewAdvert({ ...ad, images: imagesOf(ad) });
    // Read again after the slow call, so a delete or report in the meantime isn't undone.
    const latest = loadAdverts();
    const current = latest.find((a) => a.id === ad.id);
    if (!current) return res.status(404).json({ ok: false, error: "No such advert" });
    current.aiReview = review;
    saveAdverts(latest);
    res.json({ ok: true, advert: forAdmin(current, req) });
  }));

  app.delete("/admin/adverts/:id", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    saveAdverts(all.filter((a) => a.id !== ad.id));
    deleteUploads(imagesOf(ad));
    res.json({ ok: true });
  });
}
