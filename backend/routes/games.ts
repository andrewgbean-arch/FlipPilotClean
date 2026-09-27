import fs from "fs";
import path from "path";
import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { LAST_CHAPTER, progressFor, unlockWithCredits } from "../utils/nightglassStore";

/**
 * Operation Nightglass chapters for download. Chapter One is built into the app; the later chapters
 * are served from here so the app itself stays small, and the app keeps each one on the phone once it
 * has been downloaded (see src/game/nightglassDownloads.ts).
 *
 *   GET /games/nightglass/chapter<N>.html
 *
 * The app asks for ?v=<version>, so a rebuilt chapter is a new address and no cache along the way can
 * hand out an old copy. Files live in backend/public/games/nightglass; in compiled code this file is
 * backend/dist/routes, so the folder is found from either place.
 *
 * Each player's place in the season (which chapters they have unlocked, and when the next one comes)
 * belongs to their account (see utils/nightglassStore.ts):
 *
 *   GET  /games/nightglass/progress    { signedIn, unlocked, next: { chapter, unlocksAt }, unlockCredits }
 *   POST /games/nightglass/unlock      { chapter }  unlocks the next chapter now, for credits
 */
function gamesDir(): string {
  const here = path.resolve(__dirname, "..");
  const backendRoot = path.basename(here) === "dist" ? path.resolve(here, "..") : here;
  return path.join(backendRoot, "public", "games", "nightglass");
}

export default function registerGamesRoute(app: Express) {
  const dir = gamesDir();
  const released = (n: number) => n === 1 || fs.existsSync(path.join(dir, `chapter${n}.html`));

  // Signed out is an answer, not an error: the app shows "sign in to unlock" rather than a sign-in screen.
  app.get("/games/nightglass/progress", rateLimit(60), (req: Request, res: Response) => {
    if (!req.account) return res.json({ ok: true, signedIn: false });
    res.json({ ok: true, signedIn: true, ...progressFor(req.account.id) });
  });

  app.post("/games/nightglass/unlock", rateLimit(20), (req: Request, res: Response) => {
    const account = req.account;
    if (!account) {
      return res.status(401).json({ ok: false, error: "sign-in-required", message: "Please sign in with your email to unlock chapters." });
    }
    const chapter = Number(req.body?.chapter);
    if (!Number.isInteger(chapter) || chapter < 2 || chapter > LAST_CHAPTER || !released(chapter)) {
      return res.status(404).json({ ok: false, error: "not-found", message: "That chapter isn't out yet." });
    }
    const result = unlockWithCredits(account.id, chapter);
    if (result.ok) return res.json({ ...result, signedIn: true, ...result.progress });
    if (result.error === "credits-required") {
      return res.status(402).json({ ...result, message: "You need more credits to unlock this chapter now." });
    }
    return res.status(409).json({ ...result, message: "Chapters unlock in order. Play the one before it first." });
  });

  app.get("/games/nightglass/:file", (req: Request, res: Response) => {
    const file = String(req.params.file);
    // Only chapter pages, by name: nothing else in the folder (or outside it) can be asked for.
    if (!/^chapter\d{1,2}\.html$/.test(file)) return res.status(404).send("Not found");
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return res.status(404).send("Not found");
    // The server turns caching off for everything else; a chapter at a given version never changes.
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.removeHeader("Pragma");
    // The server's own security policy only allows scripts from separate files, and a chapter is one
    // self-contained page with its code, voices and pictures inside it. Without this the page never
    // gets past its loading screen in a browser. The page may be framed by the web app, and it
    // fetches nothing but its fonts.
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com data:",
        "img-src data: blob:",
        "media-src data: blob:",
        "connect-src data: blob:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors *",
      ].join("; ")
    );
    res.removeHeader("X-Frame-Options");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(full, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}
