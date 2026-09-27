import fs from "fs";
import path from "path";
import { Express, Request, Response } from "express";

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
 */
function gamesDir(): string {
  const here = path.resolve(__dirname, "..");
  const backendRoot = path.basename(here) === "dist" ? path.resolve(here, "..") : here;
  return path.join(backendRoot, "public", "games", "nightglass");
}

export default function registerGamesRoute(app: Express) {
  const dir = gamesDir();
  app.get("/games/nightglass/:file", (req: Request, res: Response) => {
    const file = String(req.params.file);
    // Only chapter pages, by name: nothing else in the folder (or outside it) can be asked for.
    if (!/^chapter\d{1,2}\.html$/.test(file)) return res.status(404).send("Not found");
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return res.status(404).send("Not found");
    // The server turns caching off for everything else; a chapter at a given version never changes.
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.removeHeader("Pragma");
    res.sendFile(full, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}
