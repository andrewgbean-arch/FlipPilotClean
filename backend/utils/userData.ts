import { loadListings, saveListings } from "../routes/publishedListings";
import { loadFairs, saveFairs, toPublicFair } from "../routes/fairs";
import { loadSellerStore, saveSellerStore } from "../routes/sellers";
import { toPublicListing } from "./sellerOrigin";
import { threadIdFor } from "../routes/messages";
import {
  anonymiseReportsBy,
  blockCountFor,
  removeAllBlocksFor,
  reportsBy,
} from "./safetyStore";
import { deleteUploads, uploadsBy } from "./uploadStore";
import { removeReadsFor } from "./readState";
import { freeScanRecordFor } from "../middleware/freeScanLimit";
import { disconnect as disconnectEbay, isConnected as ebayConnected } from "../ebay/ebaySellAuth";

/**
 * A person's data rights, for a service where the only identity is a device id.
 *
 * Export gives back everything we hold that is theirs. Delete removes it. Two
 * things are kept on purpose and the policy says so: a report someone made
 * stays, with their identity taken off, because it may matter to a safety
 * decision or a legal claim about the person they reported; and their
 * free-scan counter stays, because deleting it would reset the free allowance.
 */

function iso(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function exportUserData(deviceId: string) {
  const listings = loadListings();
  const mine = listings.filter((l: any) => l.deviceId === deviceId);

  // Threads on their own listings, from the seller's side.
  const ownListings = mine.map((l: any) => ({
    ...toPublicListing(l),
    conversations: Object.values(
      (Array.isArray(l.messages) ? l.messages : [])
        .filter((m: any) => m?.threadId)
        .reduce((acc: Record<string, any[]>, m: any) => {
          (acc[m.threadId] ??= []).push({
            from: m.author === "system" ? "FlipPilot" : m.author === "seller" ? "you" : "buyer",
            message: m.message,
            timestamp: iso(m.timestamp),
          });
          return acc;
        }, {})
    ),
  }));

  // Their side of conversations on other people's listings.
  const asBuyer = listings
    .filter((l: any) => l.deviceId !== deviceId)
    .map((l: any) => {
      const thread = (Array.isArray(l.messages) ? l.messages : []).filter(
        (m: any) => m?.threadId === threadIdFor(l.id, deviceId)
      );
      return thread.length === 0
        ? null
        : {
            listingId: l.id,
            listingTitle: l.title ?? null,
            messages: thread.map((m: any) => ({
              from: m.author === "system" ? "FlipPilot" : m.author === "buyer" ? "you" : "seller",
              message: m.message,
              timestamp: iso(m.timestamp),
            })),
          };
    })
    .filter(Boolean);

  const sellers = loadSellerStore();
  const seller = sellers.sellers.find((s) => s.deviceId === deviceId) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    about:
      "Everything FlipPilot holds that is yours on our servers. Your saved flips, photos and history live on your phone and are not here.",
    deviceId,
    sellerProfile: seller
      ? {
          displayName: seller.displayName ?? null,
          joinedAt: seller.joinedAt,
          reviewsAboutYou: sellers.reviews
            .filter((r) => r.sellerId === seller.id)
            .map((r) => ({ stars: r.stars, comment: r.comment, createdAt: r.createdAt })),
        }
      : null,
    listings: ownListings,
    conversationsAsBuyer: asBuyer,
    reviewsYouWrote: sellers.reviews
      .filter((r) => r.byDeviceId === deviceId)
      .map((r) => ({
        listingId: r.listingId,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    bootFairs: loadFairs()
      .filter((f) => f.ownerDeviceId === deviceId)
      .map((f) => toPublicFair(f, deviceId)),
    reportsYouMade: reportsBy(deviceId).map((r) => ({
      listingId: r.listingId,
      reason: r.reason,
      details: r.details,
      createdAt: r.createdAt,
    })),
    peopleYouHaveBlocked: blockCountFor(deviceId),
    freeScanCounter: freeScanRecordFor(deviceId),
    ebayAccountConnected: ebayConnected(deviceId),
    uploadedPhotos: uploadsBy(deviceId),
  };
}

export function deleteUserData(deviceId: string) {
  const listings = loadListings();
  const fairs = loadFairs();

  const photos: string[] = [];
  const collect = (raw: unknown) => {
    if (Array.isArray(raw)) for (const p of raw) if (typeof p === "string") photos.push(p);
  };

  // Their listings go, and their conversations with them. On everyone else's
  // listings only their own messages are taken out, and the other person's stay.
  let messagesRemoved = 0;
  const keptListings = listings.filter((l: any) => {
    if (l.deviceId === deviceId) {
      collect(l.photos);
      if (l.bestThumbnail) photos.push(l.bestThumbnail);
      messagesRemoved += Array.isArray(l.messages) ? l.messages.length : 0;
      return false;
    }
    if (Array.isArray(l.messages)) {
      const before = l.messages.length;
      const ownThread = threadIdFor(l.id, deviceId);
      l.messages = l.messages.filter(
        (m: any) => m?.deviceId !== deviceId && m?.threadId !== ownThread
      );
      messagesRemoved += before - l.messages.length;
    }
    return true;
  });
  saveListings(keptListings);

  const keptFairs = fairs.filter((f) => {
    if (f.ownerDeviceId === deviceId) {
      collect(f.images);
      return false;
    }
    return true;
  });
  saveFairs(keptFairs);

  const store = loadSellerStore();
  const seller = store.sellers.find((s) => s.deviceId === deviceId);
  const reviewsBefore = store.reviews.length;
  store.reviews = store.reviews.filter(
    (r) => r.byDeviceId !== deviceId && (!seller || r.sellerId !== seller.id)
  );
  store.sellers = store.sellers.filter((s) => s.deviceId !== deviceId);
  saveSellerStore(store);

  removeReadsFor(deviceId);
  const blocksRemoved = removeAllBlocksFor(deviceId);
  const reportsAnonymised = anonymiseReportsBy(deviceId);

  let ebayDisconnected = false;
  if (ebayConnected(deviceId)) {
    disconnectEbay(deviceId);
    ebayDisconnected = true;
  }

  const photosRemoved = deleteUploads([...photos, ...uploadsBy(deviceId)]);

  return {
    listingsRemoved: listings.length - keptListings.length,
    fairsRemoved: fairs.length - keptFairs.length,
    messagesRemoved,
    sellerProfileRemoved: Boolean(seller),
    reviewsRemoved: reviewsBefore - store.reviews.length,
    blocksRemoved,
    reportsAnonymised,
    ebayDisconnected,
    photosRemoved,
  };
}
