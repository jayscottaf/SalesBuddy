import type { VercelRequest } from '@vercel/node';
import { getDb } from './db';
import { sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import cookie from 'cookie';

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export async function getAuthenticatedUser(req: VercelRequest): Promise<AuthUser | null> {
  const db = getDb();
  if (!db) return null;

  // Parse session cookie
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionCookie = cookies['connect.sid'];
  if (!sessionCookie) return null;

  // Extract session ID (format: s:<sid>.<signature>)
  const match = sessionCookie.match(/^s:([^.]+)\./);
  if (!match) return null;
  const sid = match[1];

  try {
    // Look up session in database
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sid, sid));

    if (!session || !session.sess) return null;

    // Check expiration
    if (session.expire && new Date(session.expire) < new Date()) {
      return null;
    }

    // Extract user from session data
    const sessData = session.sess as any;
    const passport = sessData?.passport;
    if (!passport?.user?.claims?.sub) return null;

    return {
      id: passport.user.claims.sub,
      email: passport.user.claims.email,
      firstName: passport.user.claims.first_name,
      lastName: passport.user.claims.last_name,
    };
  } catch (error) {
    console.error('Session lookup failed:', error);
    return null;
  }
}
