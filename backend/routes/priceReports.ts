import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { callerDevice } from "../middleware/scanMeter";
import { adminOk } from "../utils/adminAuth";
import { REPORT_MAX_CHARS, addPriceReport, priceReportList } from "../utils/priceReportStore";

/**
 * "Doesn't look right? Report this" on a scan result.
 *
 *   POST /price-report                { deviceId, title, retailPrice, trendingPrice, buyPrice, sellPrice, note? }
 *   GET  /admin/price-reports?days=30                                                                    (ADMIN_TOKEN)
 */
export default function registerPriceReportRoutes(app: Express) {
  app.post("/price-report", rateLimit(20), (req: Request, res: Response) => {
    const deviceId = callerDevice(req);
    if (!deviceId) {
      return res.status(400).json({
        error: "missing-device",
        message: "Something went wrong identifying your phone. Please update the app and try again.",
      });
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";
    if (!title) return res.status(400).json({ error: "missing-title", message: "Something went wrong. Please try again." });

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, REPORT_MAX_CHARS) : "";

    const result = addPriceReport(deviceId, {
      title,
      retailPrice: num(req.body?.retailPrice),
      trendingPrice: num(req.body?.trendingPrice),
      buyPrice: num(req.body?.buyPrice),
      sellPrice: num(req.body?.sellPrice),
      note,
    });
    if (!result.ok) {
      return res.status(429).json({ error: "too-many", message: "You've reported a lot today. Please try again tomorrow." });
    }
    res.json({ ok: true, message: "Thanks — we'll look into it." });
  });

  app.get("/admin/price-reports", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const days = Number(req.query.days);
    res.json({ ok: true, ...priceReportList(Number.isFinite(days) && days >= 1 ? Math.floor(days) : 30) });
  });
}
