import type { RequestHandler } from 'express';
import { readSessionFromRequest } from './session';

const isReplit = !!process.env.REPL_ID;
const isVercel = !!process.env.VERCEL;
const isDev = process.env.NODE_ENV !== 'production';
const DEV_USER_ID = 'dev-user-id';
const DEV_USER_EMAIL = 'dev@local';

function applyClaims(req: any, userId: string, email?: string) {
  req.user = { claims: { sub: userId, email } };
}

// Unified auth resolver. Priority:
//   1. Signed magic-link session cookie (works everywhere, including Vercel)
//   2. Replit Auth session (only on Replit, production)
//   3. Dev bypass (only on non-production non-Vercel, e.g. local/Replit dev)
export const resolveUser: RequestHandler = (req, _res, next) => {
  const session = readSessionFromRequest(req);
  if (session) {
    applyClaims(req, session.userId, session.email);
    return next();
  }

  if (isReplit && !isDev && req.isAuthenticated?.()) {
    // Replit Auth has already set req.user via passport
    return next();
  }

  if (isDev && !isVercel) {
    applyClaims(req, DEV_USER_ID, DEV_USER_EMAIL);
    return next();
  }

  next();
};

export const requireAuth: RequestHandler = (req: any, res, next) => {
  resolveUser(req, res, () => {
    if (req.user?.claims?.sub) return next();
    return res.status(401).json({ message: 'Sign in required.' });
  });
};

// Used for feedback — accept anonymous but attach user when available.
export const optionalAuth: RequestHandler = (req, res, next) => {
  resolveUser(req, res, next);
};
