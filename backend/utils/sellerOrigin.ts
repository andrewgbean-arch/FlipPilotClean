import type { Request } from "express";
import { listingStatus } from "./listingStatus";

/**
 * Where a listing looks like it was posted from — as a private review flag,
 * never as a badge.
 *
 * What this is NOT: proof of anything. A £3 VPN defeats it, UK mobile traffic
 * often resolves to a carrier hub in the wrong nation, and a country code
 * cannot tell England from Wales or Scotland at all. So it flags a listing for
 * a human to glance at; it never blocks a sale and is never shown to buyers.
 *
 * The IP address itself is deliberately NOT stored. Only the country it
 * resolved to is kept, which is all a review needs and leaves no personal data
 * sitting in the listings file.
 */

export type SellerOrigin = {
  /** ISO country code from the host's edge, when there is one to trust. */
  country: string | null;
  countrySource: "edge-header" | "unavailable";
  /** What the phone said about itself. Spoofable, hence "said". */
  deviceRegion: string | null;
  deviceTimeZone: string | null;
  /** True when something is worth a look. Never acted on automatically. */
  flagged: boolean;
  reasons: string[];
};

/** Country headers set by a host's edge, in the order we prefer them. */
const EDGE_COUNTRY_HEADERS = [
  "cf-ipcountry", // Cloudflare
  "x-vercel-ip-country",
  "x-appengine-country",
  "x-country-code",
];

const UK_TIME_ZONES = ["Europe/London"];

function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value ?? "").trim().toUpperCase();
  // Cloudflare sends XX for anonymising proxies and T1 for Tor.
  if (!trimmed || trimmed === "XX" || trimmed === "T1") return null;
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * A country header is only worth reading when we know a proxy put it there.
 * With nothing in front of the server, anyone can send their own
 * `cf-ipcountry: GB` — which would turn the flag into the opposite of a
 * safeguard.
 */
function edgeCountry(req: Request): string | null {
  const behindProxy = Boolean(req.app?.get?.("trust proxy"));
  if (!behindProxy) return null;

  for (const name of EDGE_COUNTRY_HEADERS) {
    const found = headerValue(req, name);
    if (found) return found;
  }
  return null;
}

function cleanShortString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function readSellerOrigin(req: Request): SellerOrigin {
  const country = edgeCountry(req);

  // Sent by the app about its own phone. Another weak signal, free to collect.
  const deviceRegion = (() => {
    const raw = cleanShortString(req.body?.deviceRegion, 8);
    return raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  })();
  const deviceTimeZone = cleanShortString(req.body?.deviceTimeZone, 64);

  const reasons: string[] = [];

  if (country && country !== "GB") {
    reasons.push(`Connection looks like ${country}, not the UK`);
  }
  if (deviceRegion && deviceRegion !== "GB") {
    reasons.push(`Phone is set to ${deviceRegion}`);
  }
  if (deviceTimeZone && !UK_TIME_ZONES.includes(deviceTimeZone)) {
    reasons.push(`Phone clock is on ${deviceTimeZone}`);
  }

  if (!country && !deviceRegion && !deviceTimeZone) {
    reasons.push("Nothing to check — no country header and the app sent nothing");
  }

  return {
    country,
    countrySource: country ? "edge-header" : "unavailable",
    deviceRegion,
    deviceTimeZone,
    // "Nothing to check" is not a reason to flag anybody.
    flagged: reasons.some((r) => !r.startsWith("Nothing to check")),
    reasons,
  };
}

/**
 * A listing as everyone else is allowed to see it. Strips the review flag, the
 * seller's device id, and every message — conversations are private to the two
 * people in them and are only ever served by /messages.
 */
export function toPublicListing(listing: any): any {
  if (!listing || typeof listing !== "object") return listing;
  const { sellerOrigin, deviceId, messages, ...rest } = listing;
  return { ...rest, status: listingStatus(listing) };
}
