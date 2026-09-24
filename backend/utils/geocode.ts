import axios from "axios";

/**
 * Turns a UK postcode into a point on the map, used once when an advert is
 * booked so its "within 50 miles" circle can be worked out. Only the point is
 * kept afterwards. Uses postcodes.io, which is free and needs no key, and is
 * built from open data.
 */

// A full UK postcode, e.g. BN1 1AA, in any case and with or without the space.
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

/** "bn11aa" -> "BN1 1AA", or null when it isn't a postcode. */
export function cleanPostcode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(UK_POSTCODE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

// Roughly the British Isles: anything outside is not a place we can serve.
export function looksLikeUkPoint(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49.5 && lat <= 61.5 && lng >= -8.8 && lng <= 2.1;
}

export async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await axios.get(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      timeout: 6000,
    });
    const r = res.data?.result;
    if (r && typeof r.latitude === "number" && typeof r.longitude === "number") {
      return { lat: r.latitude, lng: r.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
