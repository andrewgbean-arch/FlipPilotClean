import type { Request } from "express";

import { loadListings } from "../routes/publishedListings";
import { threadIdFor } from "../routes/messages";
import { listingStatus } from "./listingStatus";
import { mediaForListing } from "./media";
import { chatKey, readEntry } from "./readState";

export type Conversation = {
  listingId: number | string;
  title: string;
  thumbnail: string | null;
  status: string;
  role: "buyer" | "seller";
  threadId: string | null;
  lastMessage: string;
  lastFrom: "me" | "them";
  lastAt: string;
  count: number;
  /** The other side has written since you last opened this chat. */
  unread: boolean;
  /** ...and since you last opened the inbox: what makes Home flash. */
  isNew: boolean;
};

/**
 * Every conversation this device is in, across every listing, newest first:
 * as a buyer (one per listing you wrote to) and as a seller (one per person who
 * wrote to you, per listing).
 */
export function buildConversations(caller: string, req: Request): Conversation[] {
  const out: Conversation[] = [];
  const reads = readEntry(caller);
  const inboxSeen = reads.inboxSeenAt ? Date.parse(reads.inboxSeenAt) : 0;

  for (const l of loadListings()) {
    const messages: any[] = (Array.isArray(l.messages) ? l.messages : []).filter(
      (m: any) => typeof m?.threadId === "string" && m.threadId
    );
    if (messages.length === 0) continue;

    const asSeller = l.deviceId === caller;
    const threads = new Map<string, any[]>();
    for (const m of messages) {
      if (!asSeller && m.threadId !== threadIdFor(l.id, caller)) continue;
      (threads.get(m.threadId) ?? threads.set(m.threadId, []).get(m.threadId)!).push(m);
    }

    const thumb = mediaForListing({ photos: l.photos, bestThumbnail: null }, req).photos?.[0] ?? null;

    for (const [threadId, msgs] of threads) {
      const last = msgs[msgs.length - 1];
      // "me" is whoever is asking: the buyer's own words if a buyer, the seller's if a seller.
      const mine = asSeller ? last.author === "seller" : last.author === "buyer";
      // FlipPilot's own note is the seller's action to the seller and news to the buyer.
      const lastFrom: "me" | "them" =
        last.author === "system" ? (asSeller ? "me" : "them") : mine ? "me" : "them";

      const lastAt = String(last.timestamp ?? "");
      const lastMs = Date.parse(lastAt);
      const chatRead = Date.parse(reads.chats[chatKey(l.id, threadId)] ?? "") || 0;

      out.push({
        listingId: l.id,
        title: typeof l.title === "string" ? l.title : "Listing",
        thumbnail: typeof thumb === "string" ? thumb : null,
        status: listingStatus(l),
        role: asSeller ? "seller" : "buyer",
        threadId: asSeller ? threadId : null,
        lastMessage: String(last.message ?? "").slice(0, 120),
        lastFrom,
        lastAt,
        count: msgs.length,
        unread: lastFrom === "them" && lastMs > chatRead,
        isNew: lastFrom === "them" && lastMs > Math.max(chatRead, inboxSeen),
      });
    }
  }

  out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return out;
}
