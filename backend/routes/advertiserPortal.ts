import crypto from "crypto";
import { Express, NextFunction, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import {
  Advert,
  Booking,
  Cta,
  DEFAULT_RADIUS_MILES,
  Placement,
  RADIUS_OPTIONS_MILES,
  allPictures,
  imagesOf,
  isTrusted,
  loadAdverts,
  performanceReport,
  placementFull,
  placementLoad,
  saveAdverts,
  totals,
  trustKey,
} from "../utils/advertStore";
import { checkAdvertLink, checkAdvertText, type Problem } from "../utils/advertCheck";
import { reviewAdvert } from "../utils/advertReview";
import { cleanPostcode, geocodePostcode, looksLikeUkPoint } from "../utils/geocode";
import { deleteUploads } from "../utils/uploadStore";
import { mediaForAdvert } from "../utils/media";
import { cleanPhone, profileFor, saveProfile, type AdvertiserProfile } from "../utils/advertiserStore";
import { MONTHLY_PENCE, PLACEMENT_NAMES, SELLABLE, SHARED_BUNDLE_PENCE, launchOfferOn, quote } from "../utils/advertPricing";
import { advertEmails } from "../utils/advertEmails";
import { billing } from "../utils/advertBilling";
import { HOLD_DAYS, addMonths, approveForPayment, freeMonthState } from "../utils/advertBooking";
import { cleanDate, cleanWebsite, resolveArea, safe, stateOf, storeArtwork, storeImage, storeImages, text } from "./adverts";

/**
 * The advertising portal: businesses book, pay for and follow their own adverts.
 *
 *   GET    /advertiser/me                    who I am, my business profile, my adverts, the price list
 *   PUT    /advertiser/profile               my business: name, website, phone, address, postcode, logo, terms
 *   POST   /advertiser/quote                 the price and how many places are left, for a booking I'm planning
 *   POST   /advertiser/adverts               send an advert for review
 *   PATCH  /advertiser/adverts/:id           change one (it is read again before it shows)
 *   POST   /advertiser/adverts/:id/withdraw  take back one I haven't paid for
 *   POST   /advertiser/adverts/:id/pay       pay for an approved one (card, or ask for an invoice)
 *   POST   /advertiser/adverts/:id/cancel    stop one at the end of the month I've paid for
 *   GET    /advertiser/adverts/:id/report    how it has done, by day
 *
 * The order an advert goes through: a business sends it -> the wording rules and the AI look at
 * it -> a person approves it (or turns it down, saying why) -> the business pays -> it shows from
 * its start date, monthly, until they cancel. Nothing shows before a person has approved it and it
 * has been paid for. Every route needs a signed-in account, whatever REQUIRE_ACCOUNT says: this is
 * someone's money and someone's business.
 */

const DAY = 24 * 3600 * 1000;
const CTAS: readonly Cta[] = ["website", "call", "directions"];

function signedIn(req: Request, res: Response, next: NextFunction) {
  if (!req.account) {
    return res.status(401).json({ ok: false, error: "sign-in-required", message: "Please sign in with your email to manage your adverts." });
  }
  next();
}

const mine = (req: Request, ad: Advert) => !!ad.ownerAccountId && ad.ownerAccountId === req.account!.id;

/** What the business sees about one of its adverts. */
function forOwner(ad: Advert, req: Request) {
  const t = totals(ad);
  return {
    ...mediaForAdvert(
      {
        id: ad.id,
        title: ad.title,
        tagline: ad.tagline,
        description: ad.description,
        images: imagesOf(ad),
        image: ad.image,
        artwork: ad.artwork ?? null,
        logo: ad.logo ?? null,
        website: ad.website,
        phone: ad.phone ?? null,
        address: ad.address ?? null,
        cta: ad.cta ?? "website",
        advertiser: ad.advertiser,
      },
      req
    ),
    placements: ad.placements,
    placementNames: ad.placements.map((p) => PLACEMENT_NAMES[p] ?? p),
    area: ad.scope === "local" ? { postcode: ad.postcode ?? null, radiusMiles: ad.radiusMiles ?? DEFAULT_RADIUS_MILES } : "nationwide",
    startsAt: ad.startsAt,
    endsAt: ad.endsAt,
    state: portalState(ad),
    booking: ad.booking
      ? {
          status: ad.booking.status,
          monthlyPence: ad.booking.monthlyPence,
          launchMonthlyPence: ad.booking.launchMonthlyPence,
          launchMonths: ad.booking.launchMonths,
          submittedAt: ad.booking.submittedAt,
          rejectedReason: ad.booking.rejectedReason ?? null,
          paidThrough: ad.booking.paidThrough ?? null,
          invoiceRequested: !!ad.booking.invoiceRequested,
          holdUntil: ad.booking.holdUntil ?? null,
          byCard: !!ad.booking.stripe?.subscriptionId,
          freeMonth: {
            ...freeMonthState(ad),
            note: ad.booking.freeMonth?.note ?? null,
            reason: ad.booking.freeMonth?.reason ?? null,
          },
        }
      : null,
    // A report someone made pauses it; the business is told it's paused, never who or why exactly.
    paused: !!ad.pausedAt && !ad.approved,
    totals: { views: t.views, taps: t.clicks, saves: t.saves },
  };
}

/** One word for where a booking has got to, for the business's dashboard. */
export function portalState(ad: Advert, now = new Date()): string {
  const b = ad.booking;
  if (!b) return stateOf(ad, now);
  if (b.status === "active" || b.status === "cancelling") {
    if (ad.pausedAt && !ad.approved) return "paused";
    if (!ad.approved) return "in-review";
    const start = new Date(ad.startsAt).getTime();
    if (b.paidThrough && now.getTime() >= new Date(b.paidThrough).getTime()) return b.status === "cancelling" ? "ended" : "payment-due";
    if (now.getTime() < start) return "starting-soon";
    return b.status === "cancelling" ? "live-until-end" : "live";
  }
  return b.status;
}

/** The wording rules, for an advert that may have no website (a Call or Directions button instead). */
function wordingProblems(ad: Pick<Advert, "advertiser" | "title" | "tagline" | "description" | "website" | "address">): Problem[] {
  const problems = checkAdvertText(ad);
  if (ad.website) problems.push(...checkAdvertLink(ad.website, ad.advertiser, ad.title));
  if (ad.address) problems.push(...checkAdvertText({ advertiser: "", title: ad.address, tagline: "", description: "" }).filter((p) => p.kind === "language"));
  return problems;
}

function problemsReply(res: Response, problems: Problem[]) {
  return res.status(422).json({
    ok: false,
    error: "advert-content",
    message: "Your advert wasn't sent: it " + problems.map((p) => p.message).join("; it ") + ". Please change it and try again.",
    problems,
  });
}

/** The advert's words and button, from what was sent (or what it had). */
function readContent(b: any, profile: AdvertiserProfile, current?: Advert): { ok: true; content: Partial<Advert> } | { ok: false; error: string } {
  const title = b.title !== undefined ? text(b.title, 80) : current?.title ?? null;
  if (!title) return { ok: false, error: "Give your advert a headline (80 characters at most)." };
  const tagline = b.tagline === undefined ? current?.tagline ?? "" : b.tagline === "" ? "" : text(b.tagline, 120);
  if (tagline === null) return { ok: false, error: "The short line is too long (120 characters at most)." };
  const description = b.description === undefined ? current?.description ?? "" : b.description === "" ? "" : text(b.description, 300);
  if (description === null) return { ok: false, error: "The description is too long (300 characters at most)." };
  const cta: Cta = b.cta !== undefined ? b.cta : current?.cta ?? "website";
  if (!CTAS.includes(cta)) return { ok: false, error: "Choose what the button does: visit your website, call you, or show the way." };
  if (cta === "website" && !profile.website) return { ok: false, error: "Add your website to your business details, or choose a Call or Directions button." };
  if (cta === "call" && !profile.phone) return { ok: false, error: "Add your phone number to your business details to use a Call button." };
  if (cta === "directions" && !profile.address) return { ok: false, error: "Add your address to your business details to use a Directions button." };
  return {
    ok: true,
    content: {
      title,
      tagline,
      description,
      cta,
      advertiser: profile.businessName,
      website: profile.website,
      phone: profile.phone,
      address: profile.address,
      logo: profile.logo,
    },
  };
}

type Plan = { placements: Placement[]; scope: "local"; startsAt: string; area: { postcode: string | null; lat: number | null; lng: number | null; radiusMiles: number } };

/** Where and when: the places, the area and the start date. Nationwide is never sold here. */
async function readPlan(b: any, profile: AdvertiserProfile, current?: Advert): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const given: unknown[] = Array.isArray(b.placements) ? [...new Set<unknown>(b.placements)] : current ? current.placements : [];
  const q = quote(given, b.scope === "nationwide" ? "nationwide" : "local");
  if (!q.ok) return { ok: false, error: q.error };
  const placements = q.lines.map((l) => l.placement);

  const radius = b.radiusMiles !== undefined ? Number(b.radiusMiles) : current?.radiusMiles ?? DEFAULT_RADIUS_MILES;
  if (!(RADIUS_OPTIONS_MILES as readonly number[]).includes(radius)) return { ok: false, error: `Choose ${RADIUS_OPTIONS_MILES.join(", ")} miles.` };
  const postcode = b.postcode !== undefined ? b.postcode : current?.postcode ?? profile.postcode;
  if (!postcode || !cleanPostcode(postcode)) return { ok: false, error: "Give the postcode your adverts should be centred on." };
  const where = await resolveArea({ scope: "local", postcode, radiusMiles: radius }, current?.postcode === cleanPostcode(postcode) ? current : undefined);
  if ("error" in where) return { ok: false, error: where.error };

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
  const start = b.startsAt !== undefined ? cleanDate(b.startsAt) : current?.startsAt ?? new Date(today).toISOString();
  if (!start) return { ok: false, error: "Choose a start date." };
  if (new Date(start).getTime() < today) return { ok: false, error: "The start date can't be in the past." };
  if (new Date(start).getTime() > today + 90 * DAY) return { ok: false, error: "Adverts can be booked up to 90 days ahead." };
  return {
    ok: true,
    plan: {
      placements,
      scope: "local",
      startsAt: start,
      area: { postcode: where.area.postcode ?? null, lat: where.area.lat ?? null, lng: where.area.lng ?? null, radiusMiles: where.area.radiusMiles ?? radius },
    },
  };
}

/** A pretend advert with this plan, for asking how full an area is. */
function probe(plan: Plan, id = "probe"): Advert {
  return {
    id,
    advertiser: "",
    title: "",
    tagline: "",
    description: "",
    images: [],
    image: "",
    website: "",
    placements: plan.placements,
    scope: "local",
    ...plan.area,
    featured: false,
    startsAt: plan.startsAt,
    endsAt: addMonths(plan.startsAt, 1),
    approved: false,
    createdAt: new Date().toISOString(),
    stats: {},
  };
}

function availability(plan: Plan, all: Advert[], ignoreId?: string) {
  // Asked one placement at a time, so a full one doesn't hide the others' numbers.
  return SELLABLE.map((p) => {
    const load = placementLoad(probe({ ...plan, placements: [p] }, ignoreId ?? "probe"), all)[0];
    if (!load) return { placement: p, name: PLACEMENT_NAMES[p], placesLeft: null, limit: null };
    return { placement: p, name: PLACEMENT_NAMES[p], placesLeft: Math.max(0, load.limit - (load.count - 1)), limit: load.limit };
  });
}

function bookingFor(q: Extract<ReturnType<typeof quote>, { ok: true }>, now: Date): Booking {
  return {
    status: "in-review",
    monthlyPence: q.monthlyPence,
    launchMonthlyPence: q.launchMonthlyPence,
    launchMonths: q.launchMonths,
    submittedAt: now.toISOString(),
    holdUntil: new Date(now.getTime() + HOLD_DAYS * DAY).toISOString(),
  };
}

/**
 * After the AI has looked: a trusted business (one a person approved before, never reported or
 * overridden) whose advert is clean goes straight to paying; anyone else waits for a person.
 */
function decide(ad: Advert, all: Advert[]): "approved" | "review" {
  const trusted = isTrusted(trustKey(ad), all.filter((a) => a.id !== ad.id));
  return trusted && wordingProblems(ad).length === 0 && ad.aiReview?.verdict === "ok" ? "approved" : "review";
}



export default function registerAdvertiserPortalRoutes(app: Express) {
  const portal = [rateLimit(60), signedIn];

  app.get("/advertiser/me", ...portal, (req: Request, res: Response) => {
    const profile = profileFor(req.account!.id);
    const ads = loadAdverts().filter((a) => mine(req, a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      ok: true,
      email: req.account!.email,
      profile: profile ? mediaForAdvert({ ...profile, image: undefined }, req) : null,
      adverts: ads.map((a) => forOwner(a, req)),
      prices: {
        monthlyPence: MONTHLY_PENCE,
        names: PLACEMENT_NAMES,
        sharedBundlePence: SHARED_BUNDLE_PENCE,
        launchHalfPrice: launchOfferOn(),
        radiusMiles: RADIUS_OPTIONS_MILES,
      },
      cardPayments: billing.cardPaymentsOn(),
    });
  });

  app.put("/advertiser/profile", ...portal, safe(async (req: Request, res: Response) => {
    const b = req.body ?? {};
    const current = profileFor(req.account!.id);
    const businessName = b.businessName !== undefined ? text(b.businessName, 80) : current?.businessName ?? null;
    if (!businessName) return res.status(400).json({ ok: false, error: "Give your business name (80 characters at most)." });
    let website = current?.website ?? "";
    if (b.website !== undefined) {
      if (b.website === "") website = "";
      else {
        const w = cleanWebsite(String(b.website).trim().replace(/^(?!https?:\/\/)/i, "https://"));
        if (!w) return res.status(400).json({ ok: false, error: "Your website must be a proper web address, like https://yourbusiness.co.uk" });
        website = w;
      }
    }
    let phone = current?.phone ?? null;
    if (b.phone !== undefined) {
      phone = b.phone === "" ? null : cleanPhone(b.phone);
      if (b.phone !== "" && !phone) return res.status(400).json({ ok: false, error: "That doesn't look like a UK phone number." });
    }
    let address = current?.address ?? null;
    if (b.address !== undefined) {
      address = b.address === "" ? null : text(b.address, 160);
      if (b.address !== "" && !address) return res.status(400).json({ ok: false, error: "The address is too long (160 characters at most)." });
    }
    let postcode = current?.postcode ?? null;
    if (b.postcode !== undefined) {
      postcode = b.postcode === "" ? null : cleanPostcode(b.postcode);
      if (b.postcode !== "" && !postcode) return res.status(400).json({ ok: false, error: "That doesn't look like a UK postcode." });
      // A postcode that looks right can still be one that no longer exists: find it now, not when they book.
      if (postcode && postcode !== current?.postcode) {
        const point = await geocodePostcode(postcode);
        if (!point || !looksLikeUkPoint(point.lat, point.lng)) return res.status(400).json({ ok: false, error: `We couldn't find ${postcode} on the map. Please check it: some older postcodes have been withdrawn.` });
      }
    }
    const words = checkAdvertText({ advertiser: businessName, title: "", tagline: "", description: address ?? "" }).filter((p) => p.kind === "language");
    if (words.length > 0) return res.status(422).json({ ok: false, error: "Please keep your business details free of bad language." });
    if (website) {
      const link = checkAdvertLink(website, businessName, "");
      if (link.length > 0) return res.status(422).json({ ok: false, error: "That website can't be used: it " + link.map((p) => p.message).join("; it ") + "." });
    }
    let logo = current?.logo ?? null;
    let oldLogo: string | null = null;
    if (b.logoBase64 !== undefined) {
      const stored = storeImage(b.logoBase64);
      if ("error" in stored) return res.status(400).json({ ok: false, error: `Logo: ${stored.error}` });
      oldLogo = logo;
      logo = stored.path;
    } else if (b.removeLogo === true) {
      oldLogo = logo;
      logo = null;
    }
    if (!current?.termsAcceptedAt && b.acceptTerms !== true) {
      if (oldLogo !== null || logo !== current?.logo) deleteUploads(logo && logo !== current?.logo ? [logo] : []);
      return res.status(400).json({ ok: false, error: "Please read and accept the advertiser terms." });
    }
    const now = new Date().toISOString();
    const profile: AdvertiserProfile = {
      accountId: req.account!.id,
      businessName,
      website,
      phone,
      address,
      postcode,
      logo,
      termsAcceptedAt: current?.termsAcceptedAt ?? now,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    saveProfile(profile);
    // The logo on adverts that are waiting to be seen follows the profile; live ones keep theirs until edited.
    const all = loadAdverts();
    let touched = false;
    for (const ad of all) {
      if (mine(req, ad) && ad.booking && ["in-review", "awaiting-payment", "rejected"].includes(ad.booking.status)) {
        ad.advertiser = businessName;
        ad.logo = logo;
        ad.website = website;
        ad.phone = phone;
        ad.address = address;
        touched = true;
      }
    }
    if (touched) saveAdverts(all);
    const stillUsed = new Set(all.flatMap((a) => (a.logo ? [a.logo] : [])));
    if (oldLogo && !stillUsed.has(oldLogo)) deleteUploads([oldLogo]);
    res.json({ ok: true, profile: mediaForAdvert({ ...profile, image: undefined }, req) });
  }));

  app.post("/advertiser/quote", ...portal, safe(async (req: Request, res: Response) => {
    const profile = profileFor(req.account!.id);
    if (!profile) return res.status(400).json({ ok: false, error: "Add your business details first." });
    const b = req.body ?? {};
    const q = quote(Array.isArray(b.placements) ? b.placements : [], b.scope === "nationwide" ? "nationwide" : "local");
    const plan = await readPlan({ ...b, placements: q.ok ? q.lines.map((l) => l.placement) : ["feed"] }, profile);
    if (!plan.ok) return res.status(400).json({ ok: false, error: plan.error });
    const all = loadAdverts();
    res.json({ ok: true, quote: q, availability: availability(plan.plan, all), area: plan.plan.area, startsAt: plan.plan.startsAt });
  }));

  app.post("/advertiser/adverts", rateLimit(20), signedIn, safe(async (req: Request, res: Response) => {
    const profile = profileFor(req.account!.id);
    if (!profile || !profile.termsAcceptedAt) return res.status(400).json({ ok: false, error: "Add your business details and accept the advertiser terms first." });
    const b = req.body ?? {};
    const content = readContent(b, profile);
    if (!content.ok) return res.status(400).json({ ok: false, error: content.error });
    const plan = await readPlan(b, profile);
    if (!plan.ok) return res.status(400).json({ ok: false, error: plan.error });
    const q = quote(plan.plan.placements, "local");
    if (!q.ok) return res.status(400).json({ ok: false, error: q.error });

    const now = new Date();
    const advert: Advert = {
      ...probe(plan.plan, crypto.randomBytes(8).toString("hex")),
      ...content.content,
      images: [],
      image: "",
      createdAt: now.toISOString(),
      stats: {},
      reports: [],
      pausedAt: null,
      ownerAccountId: req.account!.id,
      booking: bookingFor(q, now),
    } as Advert;

    const problems = wordingProblems(advert);
    if (problems.length > 0) return problemsReply(res, problems);
    const full = placementFull(advert, loadAdverts());
    if (full) {
      return res.status(409).json({ ok: false, error: "placement-full", message: `${full.label} is fully booked in your area from that date. Choose another date, a smaller area or another place.` });
    }

    let artworkPath: string | null = null;
    if (b.artworkBase64 !== undefined && b.artworkBase64 !== null) {
      if (!advert.placements.includes("scan-full")) return res.status(400).json({ ok: false, error: "Your own full-page design is only for the scan full page." });
      const art = storeArtwork(b.artworkBase64);
      if ("error" in art) return res.status(400).json({ ok: false, error: art.error });
      artworkPath = art.path;
    }
    const gave = Array.isArray(b.imagesBase64) && b.imagesBase64.length > 0;
    const stored: { paths: string[] } | { error: string } = gave ? storeImages(b.imagesBase64) : artworkPath ? { paths: [artworkPath] } : { error: "Add at least one photo (or your own full-page design)." };
    if ("error" in stored) {
      if (artworkPath) deleteUploads([artworkPath]);
      return res.status(400).json({ ok: false, error: stored.error });
    }
    advert.images = stored.paths;
    advert.image = stored.paths[0];
    advert.artwork = artworkPath;

    advert.aiReview = await reviewAdvert({ ...advert, images: [...allPictures(advert), ...(advert.logo ? [advert.logo] : [])] });

    // Read again after the slow AI call, and check the area is still free.
    const latest = loadAdverts();
    if (placementFull(advert, latest)) {
      deleteUploads(allPictures(advert));
      return res.status(409).json({ ok: false, error: "placement-full", message: "Someone booked the last place in your area a moment ago. Choose another date, a smaller area or another place." });
    }
    const verdict = decide(advert, latest);
    if (verdict === "approved") approveForPayment(advert, "auto", now);
    saveAdverts([...latest, advert]);
    void advertEmails.submitted(advert, req.account!.email, verdict === "approved").catch(() => {});
    res.json({ ok: true, advert: forOwner(advert, req) });
  }));

  app.patch("/advertiser/adverts/:id", rateLimit(30), signedIn, safe(async (req: Request, res: Response) => {
    const profile = profileFor(req.account!.id);
    if (!profile) return res.status(400).json({ ok: false, error: "Add your business details first." });
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    if (["ended", "withdrawn"].includes(ad.booking.status)) return res.status(409).json({ ok: false, error: "That advert has finished. Book a new one instead." });
    const b = req.body ?? {};
    const paid = ad.booking.status === "active" || ad.booking.status === "cancelling";
    // Once paid for, where and when it shows (and so its price) stays as booked.
    if (paid && ["placements", "postcode", "radiusMiles", "startsAt", "scope"].some((k) => b[k] !== undefined)) {
      return res.status(409).json({ ok: false, error: "Where and when a paid advert shows can't be changed here. Contact us, or book another advert." });
    }
    const content = readContent(b, profile, ad);
    if (!content.ok) return res.status(400).json({ ok: false, error: content.error });
    const next: Advert = { ...ad, ...content.content, images: imagesOf(ad), booking: { ...ad.booking } };

    if (!paid && ["placements", "postcode", "radiusMiles", "startsAt"].some((k) => b[k] !== undefined)) {
      const plan = await readPlan(b, profile, ad);
      if (!plan.ok) return res.status(400).json({ ok: false, error: plan.error });
      const q = quote(plan.plan.placements, "local");
      if (!q.ok) return res.status(400).json({ ok: false, error: q.error });
      Object.assign(next, { placements: plan.plan.placements, ...plan.plan.area, startsAt: plan.plan.startsAt, endsAt: addMonths(plan.plan.startsAt, 1) });
      next.booking = { ...next.booking!, monthlyPence: q.monthlyPence, launchMonthlyPence: q.launchMonthlyPence, launchMonths: q.launchMonths };
      if (placementFull(next, all)) return res.status(409).json({ ok: false, error: "placement-full", message: "That place is fully booked in your area from that date." });
    }

    const problems = wordingProblems(next);
    if (problems.length > 0) return problemsReply(res, problems);

    const oldPictures = allPictures(ad);
    if (Array.isArray(b.imagesBase64) && b.imagesBase64.length > 0) {
      const stored = storeImages(b.imagesBase64);
      if ("error" in stored) return res.status(400).json({ ok: false, error: stored.error });
      next.images = stored.paths;
      next.image = stored.paths[0];
    }
    if (b.artworkBase64 !== undefined && b.artworkBase64 !== null) {
      const art = storeArtwork(b.artworkBase64);
      if ("error" in art) return res.status(400).json({ ok: false, error: art.error });
      next.artwork = art.path;
    } else if (b.removeArtwork === true) {
      next.artwork = null;
    }
    if (next.artwork && !next.placements.includes("scan-full")) return res.status(400).json({ ok: false, error: "Your own full-page design is only for the scan full page." });
    if (!next.artwork && imagesOf(next).length === 0) return res.status(400).json({ ok: false, error: "Add at least one photo." });

    const changed = (["title", "tagline", "description", "cta", "advertiser", "website", "phone", "address", "logo", "artwork"] as const).some((k) => (next as any)[k] !== (ad as any)[k]) || JSON.stringify(imagesOf(next)) !== JSON.stringify(imagesOf(ad));
    const now = new Date();
    if (changed || ad.booking.status === "rejected") {
      next.aiReview = await reviewAdvert({ ...next, images: [...allPictures(next), ...(next.logo ? [next.logo] : [])] });
      // Changed words or pictures are read again before they show: a good advert can't be edited into a bad one unseen.
      next.approved = false;
      next.approvedBy = null;
      next.booking = { ...next.booking!, status: paid ? next.booking!.status : "in-review", rejectedReason: null, submittedAt: now.toISOString(), holdUntil: paid ? null : new Date(now.getTime() + HOLD_DAYS * DAY).toISOString() };
      const latestAll = loadAdverts();
      if (decide(next, latestAll) === "approved") {
        if (paid) {
          next.approved = true;
          next.approvedBy = "auto";
          next.approvedAt = now.toISOString();
        } else {
          next.booking!.status = "in-review";
          approveForPayment(next, "auto", now);
        }
      }
    }

    const latest = loadAdverts();
    if (!latest.find((a) => a.id === ad.id)) return res.status(404).json({ ok: false, error: "No such advert" });
    // Keep the counts and reports that arrived while the AI was looking.
    const merged = { ...next, stats: latest.find((a) => a.id === ad.id)!.stats, reports: latest.find((a) => a.id === ad.id)!.reports };
    saveAdverts(latest.map((a) => (a.id === ad.id ? merged : a)));
    const keep = new Set(allPictures(merged));
    deleteUploads(oldPictures.filter((p) => !keep.has(p)));
    if (changed && !merged.approved) void advertEmails.submitted(merged, req.account!.email, false).catch(() => {});
    res.json({ ok: true, advert: forOwner(merged, req), note: changed && !merged.approved ? "Thanks: we'll read your changes and let you know." : undefined });
  }));

  app.post("/advertiser/adverts/:id/withdraw", ...portal, (req: Request, res: Response) => {
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    if (!["in-review", "awaiting-payment", "rejected"].includes(ad.booking.status)) {
      return res.status(409).json({ ok: false, error: "A paid advert is stopped with Cancel, at the end of the month you've paid for." });
    }
    ad.booking.status = "withdrawn";
    ad.booking.holdUntil = null;
    ad.approved = false;
    saveAdverts(all);
    res.json({ ok: true, advert: forOwner(ad, req) });
  });

  app.post("/advertiser/adverts/:id/pay", rateLimit(20), signedIn, safe(async (req: Request, res: Response) => {
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    if (ad.booking.status !== "awaiting-payment") {
      return res.status(409).json({ ok: false, error: ad.booking.status === "in-review" ? "We're still reading your advert: you can pay as soon as it's approved." : "This advert isn't waiting for payment." });
    }
    if (ad.booking.holdUntil && Date.now() > new Date(ad.booking.holdUntil).getTime() && placementFull(ad, all)) {
      return res.status(409).json({ ok: false, error: "placement-full", message: "Sorry, the place we held for you has now been booked. Change the date or area and we'll look again." });
    }
    const byInvoice = req.body?.method === "invoice" || !billing.cardPaymentsOn();
    if (byInvoice) {
      ad.booking.invoiceRequested = true;
      saveAdverts(all);
      void advertEmails.invoiceRequested(ad, req.account!.email).catch(() => {});
      return res.json({ ok: true, mode: "invoice", advert: forOwner(ad, req) });
    }
    const session = await billing.startCheckout(ad, req.account!.email, String(req.body?.returnUrl ?? ""));
    ad.booking.stripe = { ...(ad.booking.stripe ?? {}), checkoutSessionId: session.id };
    saveAdverts(all);
    res.json({ ok: true, mode: "card", url: session.url });
  }));

  // Paid by invoice and still running: ask for next month's invoice. FlipPilot sends it and marks it
  // paid on the admin page, which extends the paid-up date by a month.
  app.post("/advertiser/adverts/:id/renew-invoice", ...portal, (req: Request, res: Response) => {
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    if (ad.booking.status !== "active") return res.status(409).json({ ok: false, error: "Only a running advert can be carried on." });
    if (ad.booking.stripe?.subscriptionId) return res.status(409).json({ ok: false, error: "This advert renews on your card by itself." });
    if (ad.booking.invoiceRequested) return res.status(409).json({ ok: false, error: "You've already asked: we'll email the invoice." });
    ad.booking.invoiceRequested = true;
    saveAdverts(all);
    void advertEmails.renewalInvoiceRequested(ad, req.account!.email).catch(() => {});
    res.json({ ok: true, advert: forOwner(ad, req) });
  });

  app.post("/advertiser/adverts/:id/cancel", ...portal, safe(async (req: Request, res: Response) => {
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    if (ad.booking.status !== "active") return res.status(409).json({ ok: false, error: "Only a running monthly advert can be cancelled." });
    if (ad.booking.stripe?.subscriptionId) await billing.cancelAtPeriodEnd(ad.booking.stripe.subscriptionId);
    ad.booking.status = "cancelling";
    // It shows to the end of what was paid for, then stops.
    if (ad.booking.paidThrough) ad.endsAt = ad.booking.paidThrough;
    saveAdverts(all);
    res.json({ ok: true, advert: forOwner(ad, req) });
  }));

  // The launch offer's promise: a quiet first month earns a month free. The business asks here;
  // a person adds it from the admin page.
  app.post("/advertiser/adverts/:id/free-month", ...portal, (req: Request, res: Response) => {
    const all = loadAdverts();
    const ad = all.find((a) => a.id === req.params.id && mine(req, a));
    if (!ad || !ad.booking) return res.status(404).json({ ok: false, error: "No such advert" });
    const { state, askFrom } = freeMonthState(ad);
    if (state !== "can-ask") {
      const why: Record<string, string> = {
        none: "The free month comes with bookings made under our launch offer, once they've been paid for.",
        "not-yet": `You can ask once your first paid month is over, from ${askFrom ? new Date(askFrom).toLocaleDateString("en-GB") : "then"}.`,
        "not-running": "The free month is added to a running advert, and this one has been cancelled.",
        "too-late": "The time to ask for this advert's free month has passed.",
        asked: "You've already asked: we'll email you when it's added.",
        granted: "This advert has already had its free month.",
        declined: "We've already answered about this advert's free month.",
      };
      return res.status(409).json({ ok: false, error: why[state] ?? "You can't ask for a free month for this advert." });
    }
    const raw = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (raw.length > 500) return res.status(400).json({ ok: false, error: "Please keep it to 500 characters." });
    ad.booking.freeMonth = { requestedAt: new Date().toISOString(), note: raw || null };
    saveAdverts(all);
    void advertEmails.freeMonthAsked(ad, req.account!.email, raw || null).catch(() => {});
    res.json({ ok: true, advert: forOwner(ad, req) });
  });

  app.get("/advertiser/adverts/:id/report", ...portal, (req: Request, res: Response) => {
    const ad = loadAdverts().find((a) => a.id === req.params.id && mine(req, a));
    if (!ad) return res.status(404).json({ ok: false, error: "No such advert" });
    const r = performanceReport(ad);
    res.json({ ok: true, report: { ...r, advertiser: undefined } });
  });
}
