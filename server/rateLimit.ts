import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }): RequestHandler {
  return (req: any, res, next) => {
    const userId = req.user?.claims?.sub || req.ip || 'anon';
    const key = `${opts.keyPrefix}:${userId}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    if (bucket.count >= opts.max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        message: `Too many requests. Try again in ${retrySec}s.`,
      });
    }
    bucket.count += 1;
    next();
  };
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref?.();
