/**
 * The part of a client's address that identifies its NETWORK, for limits that must not be got round by
 * changing address.
 *
 *   IPv4                      the address itself ("203.0.113.7").
 *   IPv4 written as IPv6      the IPv4 address ("::ffff:203.0.113.7" -> "203.0.113.7").
 *   IPv6                      the /64 it belongs to ("2001:db8:1:2:aaaa::1" -> "v6:2001:db8:1:2").
 *
 * Why the /64: an ordinary home or phone connection is given a whole /64 (billions of addresses), and a
 * script on it can send every request from a different one. Counting each address separately would give
 * it a fresh allowance every time, which is exactly what the limits using this are there to stop.
 */
export function networkOf(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let address = ip.trim();
  if (!address) return null;

  const zone = address.indexOf("%"); // "fe80::1%eth0"
  if (zone >= 0) address = address.slice(0, zone);

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) return mapped[1];

  if (!address.includes(":")) return address; // plain IPv4

  const groups = expandIpv6(address);
  if (!groups) return address; // not something we can read: use it exactly as given
  return `v6:${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}`;
}

/** The eight 16-bit groups of an IPv6 address, or null if it is not a valid one. */
function expandIpv6(address: string): number[] | null {
  let text = address;

  // An IPv4 tail ("64:ff9b::203.0.113.7") is two groups.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const parts = tail.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    text = `${text.slice(0, lastColon + 1)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const read = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const left = read(halves[0]);
  const right = halves.length === 2 ? read(halves[1]) : [];
  if (!left || !right) return null;

  if (halves.length === 1) return left.length === 8 ? left : null;

  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...new Array<number>(missing).fill(0), ...right];
}
