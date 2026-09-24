import express, { Express, NextFunction, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { requireAccount } from "../middleware/accountGuard";
import { callerDeviceId } from "./messages";
import { UPLOADS_DIR, saveUpload, sniffImage, uploadsBy } from "../utils/uploadStore";

/**
 * Photo upload for listings and boot fairs.
 *
 * The app sends one photo at a time as base64 in JSON (already shrunk on the
 * phone). What arrives is judged by its own first bytes, never by what the
 * client says it is, and is served back with headers that stop a browser from
 * treating it as anything but a picture.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS_PER_DEVICE = 100;

export default function registerUploadsRoute(app: Express) {
  app.post("/uploads", rateLimit(30), requireAccount, (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });

    const raw = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const encoded = raw.replace(/^data:image\/[a-z+]+;base64,/i, "");
    if (encoded.length < 100) {
      return res.status(400).json({ ok: false, error: "No photo received" });
    }
    // 4 characters of base64 carry 3 bytes, so this is the size check before decoding.
    if (encoded.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
      return res.status(413).json({ ok: false, error: "That photo is too large" });
    }

    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: "That photo is too large" });
    }

    const type = sniffImage(buffer);
    if (!type) {
      return res.status(400).json({ ok: false, error: "Only JPEG, PNG or WebP photos are allowed" });
    }

    if (uploadsBy(deviceId).length >= MAX_PHOTOS_PER_DEVICE) {
      return res.status(429).json({ ok: false, error: "Too many photos uploaded" });
    }

    res.json({ ok: true, path: saveUpload(deviceId, buffer, type) });
  });

  app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      index: false,
      dotfiles: "deny",
      fallthrough: false,
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
        // Helmet's default would stop the web build loading these cross-origin.
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Cache-Control", "public, max-age=86400");
      },
    })
  );

  // A picture that isn't there is a plain 404. Without this the default error
  // reply is a 500 that spells out the file's path on this server.
  app.use("/uploads", (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const missing = err?.status === 404 || err?.code === "ENOENT" || err?.code === "ENOTDIR";
    res.status(missing ? 404 : 400).json({ ok: false, error: "Not found" });
  });
}
