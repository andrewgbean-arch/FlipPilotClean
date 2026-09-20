import type { NextFunction, Request, Response } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Auto-clean old buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt + 60_000) {
      buckets.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function rateLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const route = req.path;

    // One bucket per IP and route. It used to include `body.userId` as well, but the
    // caller chooses that, so sending a different one each time gave unlimited requests.
    const key = `${ip}:${route}`;

    const now = Date.now();
    const windowMs = 60_000;

    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    // Reset window
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count++;

    if (bucket.count > maxPerMinute) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

      return res.status(429).json({
        error: "Too many requests, slow down.",
        retryAfter,
        limit: maxPerMinute,
        remaining: 0,
      });
    }

    // Add rate limit info to response headers
    res.setHeader("X-RateLimit-Limit", maxPerMinute.toString());
    res.setHeader("X-RateLimit-Remaining", (maxPerMinute - bucket.count).toString());
    res.setHeader("X-RateLimit-Reset", bucket.resetAt.toString());

    next();
  };
}
