import crypto from 'crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'sb_session';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.APP_SECRET || 'dev-insecure-session-secret-change-me';
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number; // unix ms
}

export function signSession(payload: SessionPayload): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

export function verifySession(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expectedSig = sign(b64);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.userId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, payload: Omit<SessionPayload, 'exp'>): void {
  const full: SessionPayload = { ...payload, exp: Date.now() + ONE_WEEK_MS };
  const token = signSession(full);
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${Math.floor(ONE_WEEK_MS / 1000)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
}

export function readSessionFromRequest(req: Request): SessionPayload | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = header.split(';').map(s => s.trim());
  const found = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!found) return null;
  const value = found.slice(COOKIE_NAME.length + 1);
  return verifySession(value);
}
