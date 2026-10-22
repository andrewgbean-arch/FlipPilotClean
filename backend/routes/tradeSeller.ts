import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { requireAccount } from "../middleware/accountGuard";
import { adminOk } from "../utils/adminAuth";
import { accountByEmail } from "../utils/accountStore";
import { tradeCarLimit, tradeListingsFree } from "../config/marketplacePolicy";
import { cleanBusinessName, tradeSellerFor } from "../utils/tradeSeller";
import { ensureSeller, loadSellerStore, saveSellerStore } from "./sellers";
import { loadListings, saveListings } from "./publishedListings";

/**
 * Trade sellers: a dealer lists cars in the app without Dealer OS (see utils/tradeSeller.ts).
 *
 *   GET  /trade-seller?deviceId=              whether this phone is one, and the rules that go with it
 *   POST /trade-seller                        { deviceId, businessName }: become one, or change the name (needs an account)
 *   POST /admin/trade-seller/revoke           { sellerId } or { email }: take it away again (ADMIN_TOKEN)
 *
 * Anyone with an account may say they trade: the badge says "Trade seller" and shows the name they gave, which nothing
 * checks (like a private seller's name). What it buys is room for more cars (tradeCarLimit), free while we launch
 * (tradeListingsFree). Each of their listings carries tradeSeller: true so every card can say so.
 */

const rules = () => ({ carLimit: tradeCarLimit(), free: tradeListingsFree() });

/** Marks (or unmarks) every listing this phone has made, so a card never disagrees with the seller's own record. */
function stampListings(deviceId: string, trade: boolean) {
  const listings = loadListings();
  let changed = false;
  for (const l of listings) {
    if (l.deviceId !== deviceId) continue;
    if (trade && l.tradeSeller !== true) {
      l.tradeSeller = true;
      changed = true;
    } else if (!trade && "tradeSeller" in l) {
      delete l.tradeSeller;
      changed = true;
    }
  }
  if (changed) saveListings(listings);
}

const deviceOf = (raw: unknown) => (typeof raw === "string" ? raw.trim() : "");

export default function registerTradeSellerRoutes(app: Express) {
  app.get("/trade-seller", rateLimit(60), (req: Request, res: Response) => {
    const deviceId = deviceOf(req.query.deviceId);
    if (!deviceId) return res.status(400).json({ ok: false, error: "missing-device", message: "Something went wrong identifying your phone. Please update the app and try again." });
    res.json({ ok: true, tradeSeller: tradeSellerFor(deviceId), ...rules() });
  });

  app.post("/trade-seller", rateLimit(10), requireAccount, (req: Request, res: Response) => {
    const deviceId = deviceOf(req.body?.deviceId);
    if (!deviceId) return res.status(400).json({ ok: false, error: "missing-device", message: "Something went wrong identifying your phone. Please update the app and try again." });

    const named = cleanBusinessName(req.body?.businessName);
    if (!named.ok) return res.status(400).json({ ok: false, error: "bad-business-name", message: named.message });

    // A dealer who has never listed anything has no seller record yet: make it.
    ensureSeller(deviceId);
    const store = loadSellerStore();
    const seller = store.sellers.find((s) => s.deviceId === deviceId);
    if (!seller) return res.status(500).json({ ok: false, error: "server", message: "Something went wrong. Please try again." });

    seller.tradeSeller = { businessName: named.name, since: seller.tradeSeller?.since ?? new Date().toISOString() };
    saveSellerStore(store);
    stampListings(deviceId, true);

    res.json({ ok: true, tradeSeller: seller.tradeSeller, ...rules() });
  });

  app.post("/admin/trade-seller/revoke", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    // By the seller's public id (what buyers and reports show) or the account's email: never by phone id, which the sign-in
    // guard keeps for the person it belongs to (any request naming an account's phone id must carry that account's token).
    const store = loadSellerStore();
    let seller = typeof req.body?.sellerId === "string" ? store.sellers.find((s) => s.id === req.body.sellerId) : undefined;
    if (!seller && typeof req.body?.email === "string") {
      const account = accountByEmail(req.body.email);
      if (account) seller = store.sellers.find((s) => s.deviceId === account.canonicalDeviceId);
    }
    if (!seller) return res.status(404).json({ ok: false, error: "Seller not found" });
    if (!seller.tradeSeller) return res.json({ ok: true, revoked: false });

    delete seller.tradeSeller;
    saveSellerStore(store);
    stampListings(seller.deviceId, false);
    res.json({ ok: true, revoked: true });
  });
}
