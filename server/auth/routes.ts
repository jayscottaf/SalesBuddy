import crypto from 'crypto';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/schema';
import { clearSessionCookie, readSessionFromRequest, setSessionCookie } from './session';
import { consumeMagicLinkToken, isValidEmail, issueMagicLinkToken } from './magicLink';
import { sendEmail } from '../email/send';
import { renderMagicLink } from '../email/templates';

function normalizedAppUrl(): string {
  const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000');
  return raw.replace(/\/+$/, '');
}

export function registerMagicLinkRoutes(app: Express): void {
  app.post('/api/auth/magic-link/request', async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ message: 'A valid email is required.' });
      }
      const normalized = email.toLowerCase().trim();
      const token = await issueMagicLinkToken(normalized);
      const magicUrl = `${normalizedAppUrl()}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
      const { subject, html, text } = renderMagicLink({ magicUrl, email: normalized });
      await sendEmail({
        to: normalized,
        subject,
        html,
        text,
        type: 'magicLink',
      });
      // Don't confirm existence of account — always return ok.
      return res.json({ ok: true });
    } catch (err) {
      console.error('magic-link/request failed', err);
      return res.status(500).json({ message: 'Unable to send link.' });
    }
  });

  app.get('/api/auth/magic-link/verify', async (req, res) => {
    try {
      const token = (req.query.token as string) || '';
      if (!token) return res.status(400).send('Missing token');
      const result = await consumeMagicLinkToken(token);
      if (!result) {
        return res.status(400).send('Link expired or already used. Please request a new sign-in email.');
      }
      setSessionCookie(res, { userId: result.userId, email: result.email });
      return res.redirect('/');
    } catch (err) {
      console.error('magic-link/verify failed', err);
      return res.status(500).send('Sign-in failed.');
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // Session-aware /api/auth/user. Returns 401 when unauthenticated so the client can show the login view.
  app.get('/api/auth/user', async (req, res) => {
    const session = readSessionFromRequest(req);
    if (session) {
      const [user] = await db.select().from(users).where(eq(users.id, session.userId));
      if (user) return res.json(user);
      return res.json({ id: session.userId, email: session.email });
    }
    return res.status(401).json({ message: 'Not signed in.' });
  });
}

export { normalizedAppUrl };
