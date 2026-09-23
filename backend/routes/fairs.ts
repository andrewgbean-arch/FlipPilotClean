import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { rateLimit } from "../middleware/rateLimit";
import { callerDeviceId } from "./messages";
import { mediaForFair } from "../utils/media";
import { ownedUploads } from "../utils/uploadStore";

const FAIRS_PATH = path.join(__dirname, "../data/fairs.json");

export function loadFairs(): any[] {
  if (!fs.existsSync(FAIRS_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(FAIRS_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFairs(fairs: any[]) {
  fs.writeFileSync(FAIRS_PATH, JSON.stringify(fairs, null, 2));
}

// Required to create a fair. Anything else the client sends is either
// defaulted server-side or simply dropped - a client can't set id, verified,
// featuredUntil, ownerDeviceId etc. on create.
const REQUIRED_FIELDS = [
  "name",
  "postcode",
  "nextDate",
  "daysOfWeek",
  "entryFee",
  "stallFee",
  "openingTime",
  "closingTime",
  "email",
];

// The only fields an organiser can change after listing, via PATCH - and only
// on a fair their own device created (see ownerDeviceId check below). Price,
// dates, facilities etc. are set once at listing time; if that turns out to
// be wrong the fix is a new listing, not silent edits to a public record.
//
// featuredUntil is NOT patchable: the £5 promotion has to be confirmed with the
// store on the server before it is applied, and until that exists letting the
// organiser's phone say "I paid" would let anyone feature their own listing
// for free. (The app's purchase flow is off: there is no product to buy yet.)
const PATCHABLE_FIELDS = ["cancelledDueToWeather"];

/**
 * A fair as the caller may see it. The owner's device id is the only thing that
 * proves who may manage a fair, so it never leaves the server: the caller is
 * just told whether the fair is theirs. The organiser's email is only sent
 * when they chose to show it (or to the organiser themselves).
 */
export function toPublicFair(fair: any, caller: string | null) {
  const { ownerDeviceId, ...rest } = fair;
  const isMine = Boolean(caller) && ownerDeviceId === caller;
  return {
    ...rest,
    email: isMine || rest.displayEmailPublicly ? rest.email : "",
    isMine,
  };
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export default function registerFairsRoute(app: Express) {
  /* -------------------------------------------------------
     LIST every boot fair, fête, market or garage sale anyone
     has listed. Bootfairs/index.tsx and search.tsx both filter
     and sort this client-side (search radius, "featured" etc).
  ------------------------------------------------------- */
  app.get("/fairs", (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    res.json(loadFairs().map((f) => mediaForFair(toPublicFair(f, caller), req)));
  });

  app.get("/fairs/:id", (req: Request, res: Response) => {
    const fair = loadFairs().find((f) => f.id === req.params.id);
    if (!fair) return res.status(404).json({ ok: false, error: "Boot fair not found" });
    res.json(mediaForFair(toPublicFair(fair, callerDeviceId(req)), req));
  });

  /* -------------------------------------------------------
     LIST YOUR BOOT FAIR (from bootfairs/add.tsx)
     No sign-in in this app, so like the Marketplace's own
     write routes, this is only rate-limited, not authenticated.
     The deviceId becomes ownerDeviceId, checked on PATCH below.
  ------------------------------------------------------- */
  app.post("/fairs", rateLimit(10), (req: Request, res: Response) => {
    const body = req.body ?? {};

    const missing = REQUIRED_FIELDS.filter((field) => {
      const value = body[field];
      return Array.isArray(value) ? value.length === 0 : !value;
    });
    if (missing.length > 0) {
      return res.status(400).json({ ok: false, error: `Missing required field(s): ${missing.join(", ")}` });
    }
    if (typeof body.deviceId !== "string" || !body.deviceId) {
      return res.status(400).json({ ok: false, error: "Missing deviceId" });
    }

    const fair = {
      id: "BF-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ownerDeviceId: body.deviceId,

      name: str(body.name),
      postcode: str(body.postcode),
      nextDate: str(body.nextDate),
      daysOfWeek: strArray(body.daysOfWeek),
      entryFee: str(body.entryFee),
      stallFee: str(body.stallFee),
      openingTime: str(body.openingTime),
      closingTime: str(body.closingTime),
      cancelledDueToWeather: false,

      website: typeof body.website === "string" ? body.website : undefined,
      email: str(body.email),
      displayEmailPublicly: !!body.displayEmailPublicly,
      categories: strArray(body.categories),

      address: str(body.address),
      lat: Number(body.lat) || 0,
      lng: Number(body.lng) || 0,
      hours: str(body.hours),
      frequency: str(body.frequency, "One‑off"),

      // Only photos this device really uploaded (see /uploads).
      images: ownedUploads(body.deviceId, body.images),
      featuredUntil: null,
      busyScore: 0,
      description: str(body.description),
      verified: false,
      lastUpdated: new Date().toISOString(),

      social: {},

      parking: !!body.parking,
      toilets: !!body.toilets,
      foodStalls: !!body.foodStalls,
      dogFriendly: !!body.dogFriendly,
      wheelchairAccessible: !!body.wheelchairAccessible,

      indoor: !!body.indoor,
      weatherSafe: !!body.weatherSafe,

      estimatedStalls: 0,
      estimatedVisitors: 0,

      acceptsCard: !!body.acceptsCard,
      acceptsCash: body.acceptsCash !== false,
    };

    const fairs = loadFairs();
    fairs.unshift(fair);
    saveFairs(fairs);

    res.json({ ok: true, fair: mediaForFair(toPublicFair(fair, body.deviceId), req) });
  });

  /* -------------------------------------------------------
     MANAGE YOUR LISTING (from bootfairs/details.tsx)
     "Cancelled due to bad weather" toggle and, once the £5
     promotion is live, featuredUntil. Only the device that
     listed a fair can patch it.
  ------------------------------------------------------- */
  app.patch("/fairs/:id", rateLimit(20), (req: Request, res: Response) => {
    const { deviceId, ...rest } = req.body ?? {};
    if (typeof deviceId !== "string" || !deviceId) {
      return res.status(400).json({ ok: false, error: "Missing deviceId" });
    }

    const fairs = loadFairs();
    const index = fairs.findIndex((f) => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: "Boot fair not found" });

    if (fairs[index].ownerDeviceId !== deviceId) {
      return res.status(403).json({ ok: false, error: "You can only manage boot fairs you listed yourself." });
    }

    const patch: Record<string, unknown> = {};
    for (const key of PATCHABLE_FIELDS) {
      if (key in rest) patch[key] = rest[key];
    }

    fairs[index] = { ...fairs[index], ...patch, lastUpdated: new Date().toISOString() };
    saveFairs(fairs);

    res.json({ ok: true, fair: mediaForFair(toPublicFair(fairs[index], deviceId), req) });
  });
}
