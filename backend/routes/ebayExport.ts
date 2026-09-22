import { Express, Request, Response } from "express";
import crypto from "crypto";

import {
  buildAuthorizeUrl,
  disconnect,
  ebaySellConfigured,
  exchangeCodeForTokens,
  getValidAccessToken,
  isConnected,
} from "../ebay/ebaySellAuth";
import { exportListingToEbay } from "../ebay/ebaySellApi";
import { loadListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { sellingGate } from "../middleware/sellingGate";

export default function registerEbayExportRoute(app: Express) {
  /* -------------------------------------------------------
     CONNECT: the app opens the returned URL in an auth session
     (expo-web-browser's openAuthSessionAsync), then posts the code
     it gets back to /ebay/callback.
  ------------------------------------------------------- */
  app.get("/ebay/connect-url", (req: Request, res: Response) => {
    if (!ebaySellConfigured()) {
      return res.json({ ok: false, error: "not-configured", message: "eBay export isn't set up yet." });
    }
    const deviceId = String(req.query.deviceId ?? "");
    if (!deviceId) return res.status(400).json({ ok: false, error: "Missing deviceId" });

    // The state round-trips through eBay unchanged - it's how the callback
    // knows which device this authorization belongs to.
    const state = crypto.randomBytes(8).toString("hex") + "." + Buffer.from(deviceId).toString("base64url");
    res.json({
      ok: true,
      url: buildAuthorizeUrl(state),
      // The app watches for the browser reaching this exact page to know
      // sign-in is done, then reads the ?code= eBay appended to it.
      redirectUrl: process.env.EBAY_SELL_REDIRECT_URL ?? null,
    });
  });

  app.post("/ebay/callback", rateLimit(10), async (req: Request, res: Response) => {
    const { deviceId, code } = req.body ?? {};
    if (typeof deviceId !== "string" || typeof code !== "string") {
      return res.status(400).json({ ok: false, error: "Missing deviceId or code" });
    }

    try {
      await exchangeCodeForTokens(deviceId, code);
      res.json({ ok: true, connected: true });
    } catch (err: any) {
      console.log("eBay OAuth exchange failed:", err?.response?.data ?? err?.message);
      res.json({ ok: false, error: "oauth-failed", message: "Couldn't connect your eBay account. Please try again." });
    }
  });

  app.get("/ebay/status", (req: Request, res: Response) => {
    const deviceId = String(req.query.deviceId ?? "");
    res.json({ connected: deviceId ? isConnected(deviceId) : false, configured: ebaySellConfigured() });
  });

  app.post("/ebay/disconnect", (req: Request, res: Response) => {
    const { deviceId } = req.body ?? {};
    if (typeof deviceId === "string") disconnect(deviceId);
    res.json({ ok: true });
  });

  /* -------------------------------------------------------
     EXPORT a FlipPilot listing to the seller's own eBay account.
     sellingGate applies here too - exporting is still selling.
  ------------------------------------------------------- */
  app.post("/ebay/export/:listingId", rateLimit(10), sellingGate, async (req: Request, res: Response) => {
    const { deviceId } = req.body ?? {};
    if (typeof deviceId !== "string") {
      return res.status(400).json({ ok: false, error: "Missing deviceId" });
    }

    const listing = loadListings().find((l: any) => String(l.id) === req.params.listingId);
    if (!listing) {
      return res.status(404).json({ ok: false, error: "not-found", message: "Listing not found." });
    }
    if (listing.deviceId && listing.deviceId !== deviceId) {
      return res.status(403).json({ ok: false, error: "not-yours", message: "That's not your listing." });
    }

    const accessToken = await getValidAccessToken(deviceId);
    if (!accessToken) {
      return res.json({
        ok: false,
        error: "not-connected",
        message: "Connect your eBay account first.",
      });
    }

    const result = await exportListingToEbay(accessToken, {
      id: listing.id,
      title: listing.title,
      price: Number(listing.price),
      description: listing.description,
    });

    res.json(result);
  });
}
