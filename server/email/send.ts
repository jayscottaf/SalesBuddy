import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { emailLog } from '../../shared/schema';
import { sendRawEmail, type EmailMessage } from './client';

export type EmailType = 'digest' | 'followUpReady' | 'blockerReminder' | 'magicLink';

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: EmailType;
  userId?: string;
  // If set, we won't send again for the same (type, refId, userId-or-email) combo.
  refId?: string;
}

export async function sendEmail(opts: SendOptions): Promise<{ sent: boolean; reason?: string }> {
  if (opts.refId) {
    const existing = await db
      .select()
      .from(emailLog)
      .where(
        and(
          eq(emailLog.type, opts.type),
          eq(emailLog.refId, opts.refId),
          eq(emailLog.email, opts.to)
        )
      );
    if (existing.length > 0) {
      return { sent: false, reason: 'already-sent' };
    }
  }

  const msg: EmailMessage = {
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };
  const result = await sendRawEmail(msg);
  if (!result.ok) {
    return { sent: false, reason: result.error || 'send-failed' };
  }

  try {
    await db.insert(emailLog).values({
      id: crypto.randomUUID(),
      userId: opts.userId,
      email: opts.to,
      type: opts.type,
      refId: opts.refId,
    });
  } catch (err) {
    console.error('[email] failed to record email_log', err);
  }

  return { sent: true };
}
