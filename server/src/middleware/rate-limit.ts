import type { NextFunction, Request, Response } from "express";

/**
 * Small in-memory rate limiter (fixed window per client IP + bucket).
 *
 * Good for one server instance. If the API ever runs on more than one
 * container, move this to Redis (or express-rate-limit with a shared store),
 * otherwise each instance counts separately.
 *
 * Needs `app.set("trust proxy", 1)` behind the ALB so req.ip is the real
 * client, not the load balancer.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Drop expired windows so the map doesn't grow forever.
const sweep = setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000);

sweep.unref();

export function rateLimit({
  name,
  windowMs,
  max,
  message = "Too many requests. Please wait a moment and try again.",
}: {
  name: string;
  windowMs: number;
  max: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();

    const key = `${name}:${req.ip ?? "unknown"}`;
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

const MINUTE = 60_000;

// Shared limits, by how expensive / abusable each route is.
export const limits = {
  // Whole public API: browsing availability, settings, add-ons.
  publicRead: rateLimit({ name: "public-read", windowMs: MINUTE, max: 120 }),
  // Quotes run pricing + availability queries.
  quote: rateLimit({ name: "quote", windowMs: MINUTE, max: 40 }),
  // Checkout drafts create bookings and Stripe PaymentIntents.
  checkout: rateLimit({ name: "checkout", windowMs: 10 * MINUTE, max: 20 }),
  // Booking number + email lookups; slow down guessing.
  bookingStatus: rateLimit({ name: "booking-status", windowMs: MINUTE, max: 30 }),
  contact: rateLimit({ name: "contact", windowMs: 10 * MINUTE, max: 5 }),
  auth: rateLimit({ name: "auth", windowMs: MINUTE, max: 30 }),
  // Logged-in dashboards: generous, just a safety net.
  dashboard: rateLimit({ name: "dashboard", windowMs: MINUTE, max: 600 }),
};
