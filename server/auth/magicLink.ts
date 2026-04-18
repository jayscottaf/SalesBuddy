import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { magicLinkTokens, users } from '../../shared/schema';

const TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueMagicLinkToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await db.insert(magicLinkTokens).values({
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    tokenHash,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

export async function consumeMagicLinkToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashToken(token);
  const now = new Date();
  const [row] = await db
    .select()
    .from(magicLinkTokens)
    .where(and(eq(magicLinkTokens.tokenHash, tokenHash), gt(magicLinkTokens.expiresAt, now)));
  if (!row || row.usedAt) return null;

  await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, row.id));

  const email = row.email;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const newId = crypto.randomUUID();
    await db.insert(users).values({ id: newId, email });
    userId = newId;
  }
  return { userId, email };
}

export function isValidEmail(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
