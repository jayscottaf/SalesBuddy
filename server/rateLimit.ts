import type { RequestHandler } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Durable rate limiter backed by Upstash Redis. Works correctly across serverless
// invocations because state lives outside the function instance. If the Upstash env
// vars are missing (e.g. local dev without Redis) we fall back to a no-op limiter
// so routes still respond — log loudly so it doesn't silently disappear in prod.

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map<string, Ratelimit>();

function limiterFor(keyPrefix: string, max: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const k = `${keyPrefix}:${max}:${windowMs}`;
  let existing = limiters.get(k);
  if (existing) return existing;
  const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));
  existing = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    prefix: `rl:${keyPrefix}`,
    analytics: false,
  });
  limiters.set(k, existing);
  return existing;
}

let warnedMissing = false;

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }): RequestHandler {
  return async (req: any, res, next) => {
    const userId = req.user?.claims?.sub || req.ip || 'anon';
    const limiter = limiterFor(opts.keyPrefix, opts.max, opts.windowMs);

    if (!limiter) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled.');
      }
      return next();
    }

    try {
      const result = await limiter.limit(userId);
      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
      res.setHeader('X-RateLimit-Reset', String(Math.floor(result.reset / 1000)));
      if (!result.success) {
        const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          message: `Too many requests. Try again in ${retryAfter}s.`,
        });
      }
      return next();
    } catch (err) {
      console.error('[rateLimit] limiter failed; allowing request', err);
      return next();
    }
  };
}
