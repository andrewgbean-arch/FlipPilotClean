import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { adminOk } from "../utils/adminAuth";
import { costReport, flushCosts } from "../utils/costLog";
import { marketCacheStats } from "../market-backend/fetchMarketData";

/**
 * GET /admin/costs?days=7   what the paid services have cost, per day and per scan   (ADMIN_TOKEN)
 *
 * The figures are ESTIMATES worked out from what the server actually called (see utils/costLog.ts):
 * check them against the real OpenAI and SerpAPI bills for the first week or two, and correct the
 * prices in the environment if they are off. Nothing here says who scanned or what was scanned.
 */
export default function registerCostsRoute(app: Express) {
  app.get("/admin/costs", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    flushCosts();
    const days = Number(req.query.days);
    res.json({
      ok: true,
      ...costReport(Number.isFinite(days) && days >= 1 ? Math.floor(days) : 7),
      // How often a paid lookup was answered from memory instead (since the server last started).
      savedAnswers: marketCacheStats(),
    });
  });
}
