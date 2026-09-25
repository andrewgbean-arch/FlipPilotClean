import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { callerDevice } from "../middleware/scanMeter";
import { adminOk } from "../utils/adminAuth";
import { FEEDBACK_MAX_CHARS, addFeedback, feedbackReport } from "../utils/feedbackStore";

/**
 * POST /feedback   { deviceId, kind: "feedback" | "rating", rating?: 1-5, text? }   what people tell us in the app
 * GET  /admin/feedback?days=30                                                     read it   (ADMIN_TOKEN)
 */
export default function registerFeedbackRoutes(app: Express) {
  app.post("/feedback", rateLimit(10), (req: Request, res: Response) => {
    const deviceId = callerDevice(req);
    if (!deviceId) return res.status(400).json({ error: "missing-device", message: "Something went wrong identifying your phone. Please update the app and try again." });

    const kind = req.body?.kind === "rating" ? "rating" : req.body?.kind === "feedback" ? "feedback" : null;
    if (!kind) return res.status(400).json({ error: "bad-kind", message: "Something went wrong. Please try again." });

    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, FEEDBACK_MAX_CHARS) : "";
    const rating = Number(req.body?.rating);
    if (kind === "rating" && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: "bad-rating", message: "Please choose a rating from 1 to 5 stars." });
    }
    if (kind === "feedback" && !text) {
      return res.status(400).json({ error: "empty", message: "Please write something first." });
    }

    const result = addFeedback(deviceId, { kind, rating: kind === "rating" ? rating : null, text });
    if (!result.ok) {
      return res.status(429).json({ error: "too-many", message: "You've sent a lot today. Please try again tomorrow." });
    }
    res.json({ ok: true });
  });

  app.get("/admin/feedback", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const days = Number(req.query.days);
    res.json({ ok: true, ...feedbackReport(Number.isFinite(days) && days >= 1 ? Math.floor(days) : 30) });
  });
}
