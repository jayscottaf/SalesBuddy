import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/schema';
import { followUpStore } from '../followUpStore';
import { sendEmail } from '../email/send';
import { renderBlockerReminder } from '../email/templates';
import { preferencesStore } from '../preferencesStore';

const RECENT_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function appUrl(): string {
  const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000');
  return raw.replace(/\/+$/, '');
}

export async function sendBlockerReminders(): Promise<{ attempted: number; sent: number }> {
  const cutoff = new Date(Date.now() - RECENT_REMINDER_WINDOW_MS);
  const tasks = await followUpStore.findDueReminders(cutoff);
  let attempted = 0;
  let sent = 0;
  for (const task of tasks) {
    if (!task.userId) continue;
    const prefs = await preferencesStore.getOrDefault(task.userId);
    if (!prefs.followUpEmailsEnabled) continue;
    const [user] = await db.select().from(users).where(eq(users.id, task.userId));
    if (!user?.email) continue;
    attempted += 1;

    const daysOpen = Math.max(1, Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 86400000));
    const { subject, html, text } = renderBlockerReminder({
      accountName: task.accountName || 'this account',
      blockerTitle: task.title,
      daysOpen,
      analysisUrl: `${appUrl()}/?analysisId=${encodeURIComponent(task.analysisId)}`,
    });

    const res = await sendEmail({
      to: user.email,
      subject,
      html,
      text,
      type: 'blockerReminder',
      userId: user.id,
      refId: `${task.id}-${Math.floor(Date.now() / 86400000)}`,
    });
    if (res.sent) {
      sent += 1;
      await followUpStore.markReminderSent(task.id);
    }
  }
  return { attempted, sent };
}
