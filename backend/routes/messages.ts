import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";

export default function registerMessagesRoute(app: Express) {
  app.post("/messages/:listingId", (req: Request, res: Response) => {
    const { sender, message } = req.body;

    if (!sender || !message) {
      return res.status(400).json({ ok: false, error: "Missing sender or message" });
    }

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.listingId);

    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    const newMessage = {
      sender,
      message,
      timestamp: new Date().toISOString()
    };

    listing.messages = listing.messages ?? [];
    listing.messages.push(newMessage);

    saveListings(listings);

    res.json({ ok: true, message: newMessage });
  });

  app.get("/messages/:listingId", (req: Request, res: Response) => {
    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.listingId);

    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    res.json({ ok: true, messages: listing.messages ?? [] });
  });
}
