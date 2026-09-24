import * as Location from "expo-location";

/**
 * Roughly where this phone is, for choosing which local adverts to show.
 *
 * It never asks for permission: it only uses a position if the person has
 * already allowed location (for the weather card, say), so an advert is never
 * the reason a permission box appears. With no permission there is no position,
 * and the phone is shown only nationwide adverts.
 *
 * What is sent is rounded to two decimal places (about a mile) and goes in a
 * request header, so it is used to choose adverts and then forgotten: the server
 * does not store it and the request log does not carry it.
 */

const KEEP_MS = 30 * 60_000;

let cached: { at: number; value: string | null } | null = null;
let inflight: Promise<string | null> | null = null;

async function read(): Promise<string | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return null;

    // The last position the phone already knows is plenty, and costs nothing.
    const known = await Location.getLastKnownPositionAsync();
    if (!known) return null;
    const lat = Math.round(known.coords.latitude * 100) / 100;
    const lng = Math.round(known.coords.longitude * 100) / 100;
    return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : null;
  } catch {
    return null;
  }
}

/** "lat,lng" rounded, or null when the phone hasn't shared where it is. */
export function approxLocation(): Promise<string | null> {
  if (cached && Date.now() - cached.at < KEEP_MS) return Promise.resolve(cached.value);
  if (!inflight) {
    inflight = read()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
