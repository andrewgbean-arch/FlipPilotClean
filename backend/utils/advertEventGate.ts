import crypto from "crypto";

/**
 * Honest counts for advertisers, who pay for them. Without this anyone could send "view" a
 * thousand times, and one phone scrolling past the same advert all day counted as many.
 *
 *   - a view counts once per phone, per advert, per day;
 *   - one internet address can add at most PER_ADDRESS views and taps to one advert in a day
 *     (enough for a busy shop's Wi-Fi, not enough to fake an advert's figures);
 *   - taps and saves count each time, within the same per-address limit.
 *
 * Nothing is stored: the phone's id and address are mixed with a secret that changes every day
 * and kept only in memory, so they can't be read back or joined up across days.
 */

const PER_ADDRESS = 40;

let today = "";
let salt = crypto.randomBytes(16);
const seenViews = new Set<string>();
const perAddress = new Map<string, number>();

function roll(now: Date) {
  const day = now.toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    salt = crypto.randomBytes(16);
    seenViews.clear();
    perAddress.clear();
  }
}

const mix = (...parts: string[]) => crypto.createHmac("sha256", salt).update(parts.join("|")).digest("base64url").slice(0, 22);

/** Should this event count? `viewer` is the phone's own id if it sent one; `address` its IP. */
export function shouldCount(advertId: string, type: "view" | "click" | "save", viewer: string | null, address: string, now = new Date()): boolean {
  roll(now);
  const addrKey = mix("a", advertId, address);
  const used = perAddress.get(addrKey) ?? 0;
  if (used >= PER_ADDRESS) return false;
  if (type === "view") {
    const who = mix("v", advertId, viewer && viewer.length <= 128 ? viewer : `ip:${address}`);
    if (seenViews.has(who)) return false;
    seenViews.add(who);
  }
  perAddress.set(addrKey, used + 1);
  return true;
}

/** For tests: forget everything, as a new day would. */
export function resetEventGate() {
  today = "";
  roll(new Date(0));
  today = "";
}
