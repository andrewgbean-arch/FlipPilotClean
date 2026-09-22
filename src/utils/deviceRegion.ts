/**
 * What the phone says about where it is — its region and clock.
 *
 * Both are set by whoever owns the phone, so neither proves anything. They go
 * alongside the connection's country as one more weak signal for a human to
 * glance at, never as a check that decides anything.
 */
export function deviceRegionHints(): {
  deviceRegion: string | null;
  deviceTimeZone: string | null;
} {
  let deviceRegion: string | null = null;
  let deviceTimeZone: string | null = null;

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    deviceTimeZone = resolved.timeZone ?? null;

    // "en-GB" -> "GB". Some locales have no region at all ("en"), which is fine.
    const region = String(resolved.locale ?? "")
      .split(/[-_]/)
      .find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());
    deviceRegion = region ? region.toUpperCase() : null;
  } catch {
    // Older JS engines ship without a full Intl. Sending nothing is correct.
  }

  return { deviceRegion, deviceTimeZone };
}
