import type { RequestHandler } from 'express';
import { readSessionFromRequest } from './session';

const isDev = process.env.NODE_ENV !== 'production';
const allowDevBypass = isDev && process.env.DISABLE_DEV_BYPASS !== '1' && !process.env.VERCEL;
const DEV_USER_ID = 'dev-user-id';
const DEV_USER_EMAIL = 'dev@local';

function applyClaims(req: any, userId: string, email?: string) {
  req.user = { claims: { sub: userId, email } };
}

// Unified auth resolver. Priority:
//   1. Signed magic-link session cookie
//   2. Dev bypass (only on local/non-production, disabled automatically on Vercel)
export const resolveUser: RequestHandler = (req, _res, next) => {
  const session = readSessionFromRequest(req);
  if (session) {
    applyClaims(req, session.userId, session.email);
    return next();
  }

  if (allowDevBypass) {
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

export const optionalAuth: RequestHandler = (req, res, next) => {
  resolveUser(req, res, next);
};
