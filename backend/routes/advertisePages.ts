import fs from "fs";
import path from "path";
import express, { Express, Request, Response } from "express";

/**
 * The advertising portal's own pages, served by this server so a business signs in, books and pays
 * in one place:
 *
 *   /advertise          the portal (sign in, business details, book an advert, dashboard)
 *   /advertise/terms    the advertiser terms
 *   /advertise/admin    FlipPilot's own review page (it asks for the admin token; the data
 *                       behind it is the /admin/adverts routes, which check that token)
 *
 * Plain files from backend/public/advertise: no build step, no outside scripts or fonts, so
 * visiting tells no third party anything. In compiled code this file is backend/dist/routes, so
 * the folder is found from either place.
 */

function publicDir(): string {
  const here = path.resolve(__dirname, "..");
  const backendRoot = path.basename(here) === "dist" ? path.resolve(here, "..") : here;
  return path.join(backendRoot, "public", "advertise");
}

export default function registerAdvertisePages(app: Express) {
  const dir = publicDir();
  const page = (file: string) => (_req: Request, res: Response) => {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return res.status(404).send("Not found");
    res.sendFile(full);
  };
  // The address without a slash must still load the page's own files from /advertise/.
  app.get("/advertise", (req: Request, res: Response, next) => {
    if (!req.originalUrl.split("?")[0].endsWith("/")) return res.redirect(301, "/advertise/");
    next();
  });
  app.get("/advertise/", page("index.html"));
  app.get(["/advertise/terms", "/advertise/terms/"], page("terms.html"));
  app.get(["/advertise/admin", "/advertise/admin/"], page("admin.html"));
  app.use("/advertise", express.static(dir, { index: false, fallthrough: true }));
}
