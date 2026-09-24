/** Longest ago first; never shown counts as longest ago. Ties keep their order. */
export function leastRecentFirst<T extends { id: string }>(
  adverts: T[],
  seen: Record<string, number>
): T[] {
  return adverts
    .map((ad, index) => ({ ad, index, at: seen[ad.id] ?? 0 }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((x) => x.ad);
}
