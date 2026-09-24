import { RETENTION, daysAgo, monthsAgo } from "../config/retention";
import { listedAtMs } from "./listingStatus";
import { loadListings, saveListings } from "../routes/publishedListings";
import { loadFairs, saveFairs } from "../routes/fairs";
import { loadSellerStore, saveSellerStore } from "../routes/sellers";
import { purgeReportsBefore } from "./safetyStore";
import { pruneReads } from "./readState";
import { deleteUploads, purgeOrphanUploads } from "./uploadStore";
import { purgeFreeScanRecords } from "../middleware/freeScanLimit";
import { allPictures, loadAdverts } from "./advertStore";
import { purgeAuth } from "./accountStore";

/**
 * Deletes what has outlived its retention period (config/retention.ts).
 * Everything here is synchronous file work, so a run cannot interleave with a
 * request halfway through and lose its write.
 */

function time(value: unknown): number {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

export function runRetention(now = new Date()) {
  const summary = {
    listings: 0,
    messages: 0,
    fairs: 0,
    reports: 0,
    freeScanCounters: 0,
    sellers: 0,
    reviews: 0,
    photos: 0,
    accounts: 0,
  };

  const doomedPhotos: string[] = [];

  /* ---- listings, and the conversations inside the ones that stay ---- */
  const soldCutoff = monthsAgo(RETENTION.soldListingMonths, now).getTime();
  const unsoldLifeMs = (RETENTION.listingDays + RETENTION.expiredListingGraceDays) * 24 * 60 * 60 * 1000;
  const messageCutoff = monthsAgo(RETENTION.messagesMonthsAfterLastMessage, now).getTime();

  const sellers = loadSellerStore();
  const listings = loadListings();
  const keptListings: any[] = [];

  for (const l of listings) {
    const soldAt = time(l.soldAt);
    const listed = listedAtMs(l);
    const expired = Number.isFinite(soldAt)
      ? soldAt < soldCutoff
      : Number.isFinite(listed) && listed + unsoldLifeMs < now.getTime();

    if (expired) {
      summary.listings++;
      summary.messages += Array.isArray(l.messages) ? l.messages.length : 0;
      if (Array.isArray(l.photos)) doomedPhotos.push(...l.photos);
      if (l.bestThumbnail) doomedPhotos.push(l.bestThumbnail);
      if (Number.isFinite(soldAt)) {
        const seller = sellers.sellers.find((s) => s.id === l.sellerId);
        if (seller) seller.soldArchived = (seller.soldArchived ?? 0) + 1;
      }
      continue;
    }

    if (Array.isArray(l.messages)) {
      // Messages from before conversations were private belong to nobody: gone.
      const lastByThread = new Map<string, number>();
      for (const m of l.messages) {
        if (typeof m?.threadId !== "string") continue;
        lastByThread.set(m.threadId, Math.max(lastByThread.get(m.threadId) ?? 0, time(m.timestamp) || 0));
      }
      const before = l.messages.length;
      l.messages = l.messages.filter(
        (m: any) =>
          typeof m?.threadId === "string" && (lastByThread.get(m.threadId) ?? 0) >= messageCutoff
      );
      summary.messages += before - l.messages.length;
    }
    keptListings.push(l);
  }
  if (summary.listings > 0 || summary.messages > 0) saveListings(keptListings);

  /* ---- boot fairs and events ---- */
  const fairs = loadFairs();
  const fairCutoff = daysAgo(RETENTION.fairDaysAfterDate, now).getTime();
  const staleCutoff = monthsAgo(RETENTION.unsoldListingMonths, now).getTime();
  const keptFairs = fairs.filter((f) => {
    const date = time(f.nextDate);
    const expired = Number.isFinite(date)
      ? date < fairCutoff
      : time(f.lastUpdated) < staleCutoff;
    if (expired && Array.isArray(f.images)) doomedPhotos.push(...f.images);
    return !expired;
  });
  summary.fairs = fairs.length - keptFairs.length;
  if (summary.fairs > 0) saveFairs(keptFairs);

  /* ---- sellers with nothing left to show, and orphaned reviews ---- */
  const sellerCutoff = monthsAgo(RETENTION.inactiveSellerMonths, now).getTime();
  const sellersWithListings = new Set(keptListings.map((l) => l.sellerId));
  const sellerCount = sellers.sellers.length;
  const reviewCount = sellers.reviews.length;

  sellers.sellers = sellers.sellers.filter((s) => {
    if (sellersWithListings.has(s.id)) return true;
    const lastReview = Math.max(
      0,
      ...sellers.reviews.filter((r) => r.sellerId === s.id).map((r) => time(r.createdAt) || 0)
    );
    const lastActive = Math.max(time(s.joinedAt) || 0, lastReview);
    return lastActive >= sellerCutoff;
  });
  const liveSellerIds = new Set(sellers.sellers.map((s) => s.id));
  sellers.reviews = sellers.reviews.filter((r) => liveSellerIds.has(r.sellerId));
  summary.sellers = sellerCount - sellers.sellers.length;
  summary.reviews = reviewCount - sellers.reviews.length;
  // Sold counts were bumped above, so this is saved whenever anything changed.
  saveSellerStore(sellers);

  /* ---- what each device has read: no use once the chats are gone ---- */
  pruneReads(monthsAgo(RETENTION.messagesMonthsAfterLastMessage, now));

  /* ---- sign-in codes, sessions, and accounts nobody uses ---- */
  summary.accounts = purgeAuth(RETENTION.inactiveAccountMonths, now).accounts;

  /* ---- reports and counters ---- */
  summary.reports = purgeReportsBefore(monthsAgo(RETENTION.reportMonths, now));
  summary.freeScanCounters = purgeFreeScanRecords(RETENTION.freeScanDaysAfterWeek, now);

  /* ---- photos: those of everything deleted above, then any nothing uses ---- */
  summary.photos += deleteUploads(doomedPhotos);
  const inUse = new Set<string>();
  for (const l of keptListings) {
    for (const p of Array.isArray(l.photos) ? l.photos : []) inUse.add(p);
    if (l.bestThumbnail) inUse.add(l.bestThumbnail);
  }
  for (const f of keptFairs) for (const p of Array.isArray(f.images) ? f.images : []) inUse.add(p);
  // Advert pictures are ours and belong to a booking, so they are never orphans.
  for (const a of loadAdverts()) for (const p of allPictures(a)) inUse.add(p);
  summary.photos += purgeOrphanUploads(inUse, RETENTION.orphanUploadHours, now);

  return summary;
}
