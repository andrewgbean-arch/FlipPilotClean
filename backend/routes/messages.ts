import crypto from "crypto";
import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { hasBlocked, isBlockedEitherWay } from "../utils/safetyStore";
import { chatKey, markChatRead } from "../utils/readState";

/**
 * Messages are private conversations, one per buyer per listing.
 *
 * A buyer sees only their own thread. The seller sees every thread on their own
 * listing, each under an opaque thread id — never the buyer's device id, which
 * is what proves who someone is and must not be handed to another user.
 * Nobody else can read anything: who the caller is comes from their device id,
 * and who wrote a message is decided here, never by the client.
 */

const MAX_MESSAGE_LENGTH = 1000;

export function callerDeviceId(req: Request): string | null {
  const header = req.headers["x-device-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromBody = typeof req.body?.deviceId === "string" ? req.body.deviceId : undefined;
  const id = (fromHeader ?? fromBody ?? "").trim();
  // Ids starting "system:" belong to the server itself (advert pictures) and are never a phone.
  return id && id.length <= 200 && !id.startsWith("system:") ? id : null;
}

export function threadIdFor(listingId: string | number, buyerDeviceId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${listingId}:${buyerDeviceId}`)
    .digest("hex")
    .slice(0, 16);
}

type StoredMessage = {
  // "system" is FlipPilot itself, for example asking the buyer for a review once
  // the seller has marked the item sold to them. Nobody can post as it.
  author: "buyer" | "seller" | "system";
  message: string;
  deviceId: string | null;
  threadId: string;
  timestamp: string;
  kind?: "review-request";
};

/** What a client is allowed to see of a message. */
function view(m: StoredMessage, role: "buyer" | "seller") {
  return {
    from: m.author === "system" ? "them" : m.author === role ? "me" : "them",
    sender: m.author === "system" ? "FlipPilot" : m.author === "seller" ? "Seller" : "Buyer",
    message: m.message,
    timestamp: m.timestamp,
    ...(m.kind ? { kind: m.kind } : {}),
  };
}

function ownerOf(listing: any): string | null {
  return typeof listing?.deviceId === "string" && listing.deviceId ? listing.deviceId : null;
}

export default function registerMessagesRoute(app: Express) {
  app.post("/messages/:listingId", rateLimit(20), (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) {
      return res.status(401).json({ ok: false, error: "Missing device id" });
    }

    const text = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!text) {
      return res.status(400).json({ ok: false, error: "Missing message" });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ ok: false, error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters` });
    }

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.listingId);
    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    listing.messages = Array.isArray(listing.messages) ? listing.messages : [];
    const owner = ownerOf(listing);
    const role: "buyer" | "seller" = owner && caller === owner ? "seller" : "buyer";

    let threadId: string;

    if (role === "buyer") {
      if (owner && isBlockedEitherWay(owner, caller)) {
        return res.status(403).json({
          ok: false,
          error: hasBlocked(caller, owner)
            ? "You have blocked this seller."
            : "This seller isn't taking messages from you.",
        });
      }
      threadId = threadIdFor(listing.id, caller);
    } else {
      // A seller answers people who wrote to them; they don't start conversations.
      const requested = typeof req.body?.thread === "string" ? req.body.thread : "";
      const buyerMessage = listing.messages.find(
        (m: StoredMessage) => m.threadId === requested && m.author === "buyer"
      );
      if (!buyerMessage) {
        return res.status(404).json({ ok: false, error: "No such conversation" });
      }
      const buyerDevice = buyerMessage.deviceId as string;
      if (isBlockedEitherWay(owner!, buyerDevice)) {
        return res.status(403).json({
          ok: false,
          error: hasBlocked(owner!, buyerDevice)
            ? "You have blocked this person."
            : "This person isn't taking messages from you.",
        });
      }
      threadId = requested;
    }

    const stored: StoredMessage = {
      author: role,
      message: text,
      // Kept so we can tell who is entitled to leave this seller a review.
      // Never sent back out.
      deviceId: caller,
      threadId,
      timestamp: new Date().toISOString(),
    };
    listing.messages.push(stored);
    saveListings(listings);

    res.json({ ok: true, message: view(stored, role) });
  });

  app.get("/messages/:listingId", (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) {
      return res.status(401).json({ ok: false, error: "Missing device id" });
    }

    const listing = loadListings().find((l: any) => String(l.id) === req.params.listingId);
    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    // Messages from before conversations were private have no thread and belong
    // to nobody in particular, so nobody is shown them.
    const all: StoredMessage[] = (Array.isArray(listing.messages) ? listing.messages : []).filter(
      (m: any) => typeof m?.threadId === "string" && m.threadId
    );
    const owner = ownerOf(listing);

    if (!owner || caller !== owner) {
      const myThread = threadIdFor(listing.id, caller);
      const mine = all.filter((m) => m.threadId === myThread);
      // Fetching your own chat is reading it.
      if (mine.length > 0) markChatRead(caller, chatKey(listing.id, myThread));
      return res.json({
        ok: true,
        role: "buyer",
        blocked: owner ? hasBlocked(caller, owner) : false,
        messages: mine.map((m) => view(m, "buyer")),
      });
    }

    const wanted = typeof req.query.thread === "string" ? req.query.thread : "";
    if (wanted) {
      const thread = all.filter((m) => m.threadId === wanted);
      if (thread.length > 0) markChatRead(caller, chatKey(listing.id, wanted));
      const buyerId = thread.find((m) => m.author === "buyer")?.deviceId;
      return res.json({
        ok: true,
        role: "seller",
        blocked: buyerId ? hasBlocked(owner, buyerId) : false,
        messages: thread.map((m) => view(m, "seller")),
      });
    }

    const byThread = new Map<string, StoredMessage[]>();
    for (const m of all) {
      const list = byThread.get(m.threadId) ?? [];
      list.push(m);
      byThread.set(m.threadId, list);
    }
    const threads = [...byThread.entries()]
      .map(([threadId, msgs]) => {
        const last = msgs[msgs.length - 1];
        return {
          threadId,
          lastMessage: last.message.slice(0, 120),
          // FlipPilot's own notes are not the buyer speaking, so not "them".
          lastFrom: last.author === "buyer" ? "them" : "me",
          lastAt: last.timestamp,
          count: msgs.length,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

    res.json({ ok: true, role: "seller", threads });
  });
}
