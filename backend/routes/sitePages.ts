import fs from "fs";
import path from "path";
import express, { Express, Request, Response } from "express";
import { RETENTION } from "../config/retention";
import { MONTHLY_FREE_LIMIT } from "../middleware/freeScanLimit";
import { PRO_DAILY_SCANS } from "../utils/proAllowance";

/**
 * FlipPilot's public website (flippilot.co.uk), served by this same server:
 *
 *   /                 the home page (to a browser; anything else asking for / still gets the health check)
 *   /privacy          the Privacy Policy
 *   /terms            the Terms of Use
 *   /delete-account   how to delete an account, and what that removes and keeps
 *
 * Plain files from backend/public/site: no build step, no cookies, no outside scripts, fonts or
 * images, so visiting tells no third party anything (the Privacy Policy says exactly that).
 *
 * The numbers in those pages (how long things are kept, how many scans are free) are written as
 * {{tokens}} and filled in here from the settings the server itself runs on (config/retention.ts
 * is also what the clean-up job uses), so a published policy cannot say 12 months while the job
 * deletes after 6.
 */

/** Every {{token}} a page may use, and the number it stands for. */
export const SITE_TOKENS: Record<string, number> = {
  freeScans: MONTHLY_FREE_LIMIT,
  proDailyScans: PRO_DAILY_SCANS,
  listingDays: RETENTION.listingDays,
  graceDays: RETENTION.expiredListingGraceDays,
  soldMonths: RETENTION.soldListingMonths,
  messagesMonths: RETENTION.messagesMonthsAfterLastMessage,
  fairDays: RETENTION.fairDaysAfterDate,
  reportMonths: RETENTION.reportMonths,
  freeScanDays: RETENTION.freeScanDaysAfterWeek,
  inactiveSellerMonths: RETENTION.inactiveSellerMonths,
  inactiveAccountMonths: RETENTION.inactiveAccountMonths,
  paymentRecordYears: RETENTION.paymentRecordYears,
};

/** Fills the {{tokens}}. An unknown one is a mistake in the page, so it throws rather than publishing "{{...}}". */
export function fillTokens(html: string, name = "page"): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_all, token: string) => {
    if (!(token in SITE_TOKENS)) throw new Error(`${name} uses {{${token}}}, which isn't a known number`);
    return String(SITE_TOKENS[token]);
  });
}

function publicDir(): string {
  const here = path.resolve(__dirname, "..");
  const backendRoot = path.basename(here) === "dist" ? path.resolve(here, "..") : here;
  return path.join(backendRoot, "public", "site");
}

export default function registerSitePages(app: Express) {
  const dir = publicDir();
  const rendered = new Map<string, string>();

  const render = (file: string): string => {
    const known = rendered.get(file);
    if (known !== undefined) return known;
    const html = fillTokens(fs.readFileSync(path.join(dir, file), "utf8"), file);
    rendered.set(file, html);
    return html;
  };

  const page = (file: string) => (_req: Request, res: Response) => {
    try {
      res.type("html").send(render(file));
    } catch (err: any) {
      console.error("SITE PAGE ERROR:", file, err?.message ?? err);
      res.status(500).type("text").send("This page isn't available right now. Please try again in a few minutes.");
    }
  };

  // A browser asks for HTML; the host's health check and the app's own calls don't, and carry on to the JSON "backend running" reply.
  app.get("/", (req: Request, res: Response, next) => {
    if (req.accepts(["json", "html"]) !== "html") return next();
    page("index.html")(req, res);
  });
  app.get("/privacy", page("privacy.html"));
  app.get("/terms", page("terms.html"));
  app.get("/delete-account", page("delete-account.html"));

  // Only the assets folder is served as files, so the page templates (with their {{tokens}}) are never reachable raw.
  const assets = path.join(dir, "assets");
  app.use("/site-assets", express.static(assets, { index: false, fallthrough: true }));
  app.get("/favicon.ico", (_req: Request, res: Response) => {
    res.sendFile(path.join(assets, "favicon.png"), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
}
