import crypto from "crypto";
import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import {
  Advert,
  PLACEMENTS,
  Placement,
  addAdvertReport,
  bootfairAdverts,
  feedAdverts,
  findClash,
  loadAdverts,
  recordEvent,
  saveAdverts,
  scanAdverts,
  toPublicAdvert,
  totals,
} from "../utils/advertStore";
import { checkAdvert, blocking } from "../utils/advertCheck";
import { reviewAdvert } from "../utils/advertReview";
import { mediaForAdvert } from "../utils/media";
import { deleteUploads, saveUpload, sniffImage } from "../utils/uploadStore";
import { callerDeviceId } from "./messages";
import { REPORT_REASONS } from "./safety";

/**
 * Adverts.
 *
 * The public side only ever returns what is booked, approved and in date right
 * now, so an advert that has ended, or was never approved, simply isn't there.
 *
 * The admin side is for whoever runs FlipPilot: off unless ADMIN_TOKEN is set,
 * and then it needs that token in the x-admin-token header. Every advert goes
 * through three checks on the way to being live:
 *   1. wording and link rules (swearing is always refused; scam wording and
 *      dodgy links are refused unless the approver says they have looked),
 *   2. an AI look at the wording and picture, saved with the advert,
 *   3. a person approving it. Nothing else can approve an advert.
 * And once live, enough different people reporting it takes it off again.
 */

const IMAGE_OWNER = "advertiser-images";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function adminOk(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(404).json({ ok: false, error: "Not enabled" });
    return false;
  }
  const a = Buffer.from(String(req.headers["x-admin-token"] ?? ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ ok: false, error: "Unauthorised" });
    return false;
  }
  return true;
}

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

/** Saves a picture sent as base64, judged by its own bytes. */
function storeImage(raw: unknown): { path: string } | { error: string } {
  const encoded = typeof raw === "string" ? raw.replace(/^data:image\/[a-z+]+;base64,/i, "") : "";
  if (encoded.length < 100) return { error: "No picture received" };
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length > MAX_IMAGE_BYTES) return { error: "That picture is too large" };
  const type = sniffImage(buffer);
  if (!type) return { error: "Only JPEG, PNG or WebP pictures are allowed" };
  return { path: saveUpload(IMAGE_OWNER, buffer, type) };
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
    ...mediaForAdvert(ad, req),
    totals: totals(ad),
    state,
    // Something a person has to look at: not approved yet (or taken off), and not already over.
    needsAttention: !ad.approved && new Date(ad.endsAt).getTime() > Date.now(),
    reportCount: new Set((ad.reports ?? []).map((r) => r.deviceId)).size,
  };
}

function clashReply(res: Response, clash: NonNullable<ReturnType<typeof findClash>>) {
  return res.status(409).json({
    ok: false,
    error: "placement-taken",
    message: `${clash.placement} is already booked by ${clash.with.advertiser} from ${clash.with.startsAt} to ${clash.with.endsAt}.`,
  });
}

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
    const shape = (ads: Advert[]) => ads.map((a) => mediaForAdvert(toPublicAdvert(a), req));

    res.setHeader("Cache-Control", "no-store");
    if (placement === "scan") {
      const s = scanAdverts();
      return res.json({ ok: true, layout: s.layout, adverts: shape(s.adverts) });
    }
    if (placement === "feed") {
      const f = feedAdverts();
      return res.json({ ok: true, sole: f.sole, adverts: shape(f.adverts) });
    }
    if (placement === "bootfairs") {
      return res.json({ ok: true, adverts: shape(bootfairAdverts()) });
    }
    return res.status(400).json({ ok: false, error: "Unknown placement" });
  });

  // A view or a tap. Counts only: who did it is never recorded.
  app.post("/adverts/:id/event", rateLimit(240), (req: Request, res: Response) => {
    const type = req.body?.type;
    if (type !== "view" && type !== "click") {
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

  app.post("/admin/adverts", async (req: Request, res: Response) => {
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

    const draft = { id: crypto.randomBytes(8).toString("hex"), placements, startsAt, endsAt };
    const clash = findClash(draft, loadAdverts());
    if (clash) return clashReply(res, clash);

    // Rude or scammy wording is stopped before anything is saved.
    const wording = { advertiser, title, tagline, description, website };
    const problems = blocking(checkAdvert(wording), b.reviewed === true);
    if (problems.length > 0) return contentReply(res, problems);

    const image = storeImage(b.imageBase64);
    if ("error" in image) return res.status(400).json({ ok: false, error: image.error });

    const aiReview = await reviewAdvert({ ...wording, image: image.path });

    // Asking for it to be approved only sticks when the AI found nothing to look at.
    // Otherwise it waits for a person, using the PATCH route, having read the AI's reasons.
    const wantsApproval = b.approved === true;
    const approved = wantsApproval && aiReview.verdict === "ok";

    const advert: Advert = {
      ...draft,
      advertiser,
      title,
      tagline,
      description,
      image: image.path,
      website,
      featured: b.featured === true,
      approved,
      createdAt: new Date().toISOString(),
      stats: {},
      aiReview,
      reports: [],
      pausedAt: null,
    };
    saveAdverts([...loadAdverts(), advert]);
    res.json({
      ok: true,
      advert: forAdmin(advert, req),
      ...(wantsApproval && !approved
        ? { note: `Saved, but not approved: the AI check said "${aiReview.verdict}". Read its reasons, then approve it yourself if you are happy.` }
        : {}),
    });
  });

  app.patch("/admin/adverts/:id", async (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    const b = req.body ?? {};
    const next: Advert = { ...ad };

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

    const clash = findClash(next, all);
    if (clash) return clashReply(res, clash);

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

    let oldImage: string | null = null;
    if (b.imageBase64 !== undefined) {
      const image = storeImage(b.imageBase64);
      if ("error" in image) return res.status(400).json({ ok: false, error: image.error });
      oldImage = ad.image;
      next.image = image.path;
    }

    // Different words or picture, or never looked at (an older record): the AI looks again.
    if (wordingChanged || oldImage || !ad.aiReview) {
      next.aiReview = await reviewAdvert(next);
    }

    if (approving) {
      if (next.aiReview?.verdict === "reject" && b.reviewed !== true) {
        if (oldImage) deleteUploads([next.image]);
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

    saveAdverts(all.map((a) => (a.id === ad.id ? next : a)));
    if (oldImage) deleteUploads([oldImage]);
    res.json({ ok: true, advert: forAdmin(next, req) });
  });

  // Run the AI check again, for example after switching the key on.
  app.post("/admin/adverts/:id/review", async (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    ad.aiReview = await reviewAdvert(ad);
    saveAdverts(all);
    res.json({ ok: true, advert: forAdmin(ad, req) });
  });

  app.delete("/admin/adverts/:id", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id);
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    saveAdverts(all.filter((a) => a.id !== ad.id));
    deleteUploads([ad.image]);
    res.json({ ok: true });
  });
}
