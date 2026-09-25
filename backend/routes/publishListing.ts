import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { requireAccount } from "../middleware/accountGuard";
import { adminOk } from "../utils/adminAuth";
import { evaluatePolicy, listingPolicy } from "../middleware/listingPolicy";
import { POLICY, promoActive, promoEndsAt } from "../config/marketplacePolicy";
import { payForCar, refundCar, verifyCar, type StoredVehicle } from "../utils/carListing";
import { RETENTION } from "../config/retention";
import { readSellerOrigin, toPublicListing } from "../utils/sellerOrigin";
import { ensureSeller } from "./sellers";
import { mediaForListing } from "../utils/media";
import { ownedUploads } from "../utils/uploadStore";

/**
 * The per-category answers, kept as a flat map of short strings.
 * Anything else a client sends — nested objects, huge blobs, hundreds of keys —
 * is dropped rather than stored.
 */
function cleanDetails(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 24) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)) continue;
    // A car's registration is private (see utils/carListing.ts): it is checked and kept apart, never shown.
    if (key.toLowerCase() === "registration") continue;
    if (typeof value !== "string" && typeof value !== "number") continue;

    const text = String(value).trim();
    if (text) out[key] = text.slice(0, 300);
  }
  return out;
}

/** A listing id that no existing listing has, even if two arrive in the same millisecond. */
function nextListingId(): number {
  const used = new Set(loadListings().map((l: any) => l.id));
  let id = Date.now();
  while (used.has(id)) id += 1;
  return id;
}

/**
 * Everything a car has to pass before it is saved: the DVLA check, then (with nothing awaited between
 * here and the save, so two requests can't both get through) the rules again and the credits.
 * Returns what to answer with if it fails, or the checked vehicle and what was paid.
 */
async function passCar(
  req: Request,
  input: { registration: unknown; make: unknown; mileage?: unknown }
): Promise<
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; vehicle: StoredVehicle | null; paid: { charged: number; accountId: string | null } }
> {
  const deviceId = String(req.body.deviceId);
  const checked = await verifyCar(input);
  if (!checked.ok) return checked;

  // The check took a moment: another request may have listed a car, or spent the credits, meanwhile.
  const again = evaluatePolicy(deviceId, true, undefined, req.account?.id);
  if (again) return { ok: false, status: again.status, body: again.body };

  const paid = payForCar(req.account, deviceId);
  if (!paid.ok) return paid;
  return { ok: true, vehicle: checked.vehicle, paid };
}

export default function registerPublishListingRoute(app: Express) {
  /* -------------------------------------------------------
     THE RULES, for the sell screen: is the launch offer on, when does it end,
     and what are the limits. Public and harmless.
  ------------------------------------------------------- */
  app.get("/marketplace/policy", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      promoActive: promoActive(),
      promoEndsAt: promoEndsAt()?.toISOString() ?? null,
      maxActiveCars: POLICY.maxActiveCarsPerSeller,
      freeActiveItemsAfterPromo: POLICY.freeActiveItemsAfterPromo,
      carCreditCost: POLICY.carCreditCost,
      boostCreditCost: POLICY.boostCreditCost,
      boostDays: POLICY.boostDays,
      listingDays: RETENTION.listingDays,
    });
  });

  /* -------------------------------------------------------
     PUBLISH A FLIP (from marketplace/PublishFlip.tsx)
  ------------------------------------------------------- */
  app.post("/publish-flip", rateLimit(10), requireAccount, listingPolicy, async (req: Request, res: Response) => {
    const { title, price, mileage, description, location, deviceId } = req.body;

    if (!title || !price || !description || !location) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // Every listing here is a car, so it is checked and paid for like one.
    let car: Awaited<ReturnType<typeof passCar>>;
    try {
      car = await passCar(req, { registration: req.body.registration, make: req.body.make, mileage: req.body.mileage });
    } catch (err: any) {
      console.error("publish-flip car check failed:", err?.message);
      return res.status(500).json({ ok: false, error: "server", message: "Something went wrong. You haven't been charged. Please try again." });
    }
    if (!car.ok) return res.status(car.status).json(car.body);

    try {
    const listings = loadListings();

    const listing = {
      id: nextListingId(),
      type: "flip",
      title: String(title).trim().slice(0, 120),
      price: Number(price),
      mileage: mileage != null ? Number(mileage) : null,
      description: String(description).trim().slice(0, 4000),
      location: String(location).trim().slice(0, 120),
      deviceId: typeof deviceId === "string" ? deviceId : null,
      sellerId: ensureSeller(deviceId)?.id ?? null,
      soldAt: null,
      sellerOrigin: readSellerOrigin(req),
      createdAt: new Date().toISOString(),
      messages: [],
      // Private: the checked registration, and what was paid.
      dvlaCheck: car.vehicle ?? undefined,
      creditsPaid: car.paid.charged,
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing: toPublicListing(listing) });
    } catch (err: any) {
      refundCar(car.paid);
      console.error("publish-flip could not be saved:", err?.message);
      res.status(500).json({ ok: false, error: "server", message: "Something went wrong. You haven't been charged. Please try again." });
    }
  });

  /* -------------------------------------------------------
     CREATE A GENERAL LISTING (from marketplace/create/new.tsx)
  ------------------------------------------------------- */
  app.post("/create-listing", rateLimit(10), requireAccount, listingPolicy, async (req: Request, res: Response) => {
    const {
      title,
      price,
      description,
      category,
      location,
      condition,
      details,
      photos,
      deviceId,
      sellerName
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // A listing with no category is a listing nobody finds, so it is not optional.
    // Which categories exist is the app's business; the server only insists there is one.
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ ok: false, error: "Missing category" });
    }

    // Only photos this device really uploaded (see /uploads) are kept; anything
    // else, such as a file path on the seller's phone, is dropped.
    const ownPhotos = ownedUploads(typeof deviceId === "string" ? deviceId : null, photos);

    // A car (the Motors category) must be a real, registered car, and costs credits once the launch offer is over.
    let car: Awaited<ReturnType<typeof passCar>> | null = null;
    if (category.trim().toLowerCase() === POLICY.carCategory) {
      try {
        car = await passCar(req, { registration: details?.registration ?? req.body.registration, make: details?.make, mileage: details?.mileage });
      } catch (err: any) {
        console.error("create-listing car check failed:", err?.message);
        return res.status(500).json({ ok: false, error: "server", message: "Something went wrong. You haven't been charged. Please try again." });
      }
      if (!car.ok) return res.status(car.status).json(car.body);
    }

    try {
    const listings = loadListings();

    const listing = {
      id: nextListingId(),
      type: "item",
      title: String(title).trim().slice(0, 120),
      price: Number(price),
      description: typeof description === "string" ? description.trim().slice(0, 4000) : "",
      category: category.trim().slice(0, 60),
      location: typeof location === "string" && location.trim() ? location.trim().slice(0, 120) : null,
      condition: typeof condition === "string" && condition.trim() ? condition.trim().slice(0, 60) : null,
      // The category's own questions — size, dimensions, network lock and so on.
      details: cleanDetails(details),
      photos: ownPhotos,
      bestThumbnail: ownPhotos[0] ?? null,
      // No FlipScore on a marketplace listing: it is worked out from eBay data,
      // which eBay's API terms keep out of a competing marketplace. Whatever a
      // client sends is ignored.
      deviceId: typeof deviceId === "string" ? deviceId : null,
      // The public side of who is selling it, so a buyer can see their history.
      sellerId: ensureSeller(deviceId, sellerName)?.id ?? null,
      soldAt: null,
      // A private review flag. Stripped from everything the public can read.
      sellerOrigin: readSellerOrigin(req),
      createdAt: new Date().toISOString(),
      messages: [],
      // Private: the checked registration, and what was paid (cars only).
      ...(car && car.ok ? { dvlaCheck: car.vehicle ?? undefined, creditsPaid: car.paid.charged } : {}),
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing: mediaForListing(toPublicListing(listing), req) });
    } catch (err: any) {
      if (car && car.ok) refundCar(car.paid);
      console.error("create-listing could not be saved:", err?.message);
      res.status(500).json({ ok: false, error: "server", message: "Something went wrong. You haven't been charged. Please try again." });
    }
  });

  /* -------------------------------------------------------
     MY LISTINGS
     Only ever the caller's own. With no device id there is no "own", so
     the answer is nothing rather than everybody's listings.
  ------------------------------------------------------- */
  app.get("/my-listings", (req: Request, res: Response) => {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
    if (!deviceId) return res.json([]);
    const mine = loadListings().filter((l: any) => l.deviceId === deviceId);
    res.json(mine.map((l: any) => mediaForListing(toPublicListing(l), req)));
  });

  /* -------------------------------------------------------
     FLAGGED LISTINGS — for whoever runs the marketplace, nobody else.
     Off unless ADMIN_TOKEN is set on the server, and then it needs that
     token in the x-admin-token header. Without this the origin flag would
     be data nobody can ever see.
  ------------------------------------------------------- */
  app.get("/admin/flagged-listings", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;

    const flagged = loadListings()
      .filter((l: any) => l.sellerOrigin?.flagged)
      .map((l: any) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        category: l.category,
        location: l.location,
        createdAt: l.createdAt,
        sellerOrigin: l.sellerOrigin
      }));

    res.json({ ok: true, count: flagged.length, listings: flagged });
  });
}
