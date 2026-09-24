import crypto from "crypto";
import { Express, Request, Response } from "express";
import { loadListings } from "./publishedListings";
import { callerDeviceId } from "./messages";
import { rateLimit } from "../middleware/rateLimit";
import { requireAccount } from "../middleware/accountGuard";
import { adminOk } from "../utils/adminAuth";
import { addBlock, addReport, loadReports, removeBlock } from "../utils/safetyStore";

/**
 * Report and block, which the app stores need to see before they will list a
 * place where strangers can message each other.
 *
 * A report goes to whoever runs the marketplace and nobody else. A block is
 * the blocker's own choice and is never announced to the person blocked beyond
 * the message being refused.
 */

export const REPORT_REASONS = ["scam", "fake", "abusive", "prohibited", "other"] as const;

/** Who a block or report is aimed at: the seller, or one buyer on your own listing. */
function targetFor(
  listing: any,
  caller: string,
  threadId: string | null
): { target: string | null; error?: string } {
  const owner = typeof listing.deviceId === "string" && listing.deviceId ? listing.deviceId : null;

  if (owner && caller === owner) {
    const buyerMessage = (listing.messages ?? []).find(
      (m: any) => m.threadId === threadId && m.author === "buyer"
    );
    if (!buyerMessage) return { target: null, error: "No such conversation" };
    return { target: buyerMessage.deviceId };
  }

  if (!owner) return { target: null, error: "This listing has no seller to block" };
  return { target: owner };
}

export default function registerSafetyRoute(app: Express) {
  app.post("/safety/report", rateLimit(10), requireAccount, (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    const reason = String(req.body?.reason ?? "");
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      return res.status(400).json({ ok: false, error: "Pick a reason for the report" });
    }

    const listing = loadListings().find((l: any) => String(l.id) === String(req.body?.listingId));
    if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });

    const details =
      typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 500) : "";
    const threadId =
      typeof req.body?.thread === "string" && req.body.thread ? req.body.thread : null;

    addReport({
      id: crypto.randomBytes(8).toString("hex"),
      reporterDeviceId: caller,
      listingId: String(listing.id),
      threadId,
      reason,
      details,
      createdAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  for (const action of ["block", "unblock"] as const) {
    app.post(`/safety/${action}`, rateLimit(20), (req: Request, res: Response) => {
      const caller = callerDeviceId(req);
      if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

      const listing = loadListings().find((l: any) => String(l.id) === String(req.body?.listingId));
      if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });

      const threadId =
        typeof req.body?.thread === "string" && req.body.thread ? req.body.thread : null;
      const { target, error } = targetFor(listing, caller, threadId);
      if (!target) return res.status(404).json({ ok: false, error });
      if (target === caller) {
        return res.status(400).json({ ok: false, error: "You can't block yourself" });
      }

      if (action === "block") addBlock(caller, target);
      else removeBlock(caller, target);

      res.json({ ok: true, blocked: action === "block" });
    });
  }

  /* -------------------------------------------------------
     REPORTS — for whoever runs the marketplace, nobody else.
     Off unless ADMIN_TOKEN is set, then needs it in x-admin-token.
  ------------------------------------------------------- */
  app.get("/admin/reports", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    res.json(loadReports());
  });
}
