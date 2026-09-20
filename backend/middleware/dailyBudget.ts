import type { NextFunction, Request, Response } from "express";

/* --------------------------------------------------
   A daily cap on the lookups that cost real money.

   Every scan calls paid services (OpenAI vision and price estimates, SerpAPI,
   eBay). The per-minute limiter stops one person hammering the server, but not
   a crowd, so this puts a ceiling on the whole server per day. When it is hit,
   scans answer "busy, try again later" instead of running up a bill.

   Set DAILY_LOOKUP_LIMIT in the environment to change it (default 3000). It counts
   in memory, so it resets when the server restarts and each server instance
   counts for itself.
-------------------------------------------------- */
const limit = () => {
  const fromEnv = Number(process.env.DAILY_LOOKUP_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3000;
};

let day = new Date().toISOString().slice(0, 10);
let used = 0;
let warned = false;

export function paidLookupBudget(req: Request, res: Response, next: NextFunction) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
    warned = false;
  }

  if (used >= limit()) {
    if (!warned) {
      console.warn(`Daily lookup limit of ${limit()} reached; scans are paused until tomorrow.`);
      warned = true;
    }
    return res.status(503).json({
      error: "busy",
      message: "FlipPilot is very busy right now. Please try again a little later.",
    });
  }

  used += 1;
  next();
}
