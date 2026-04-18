import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db';
import { analyses, users } from '../../shared/schema';
import { sendEmail } from '../email/send';
import { renderWeeklyDigest, type DigestDataAnalysis } from '../email/templates';
import { preferencesStore } from '../preferencesStore';

function startOfWeek(d: Date): Date {
  // Treat Monday as start of work week.
  const date = new Date(d);
  const day = date.getDay(); // 0..6 with 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function appUrl(): string {
  const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000');
  return raw.replace(/\/+$/, '');
}

export async function sendWeeklyDigestsIfDue(options: { force?: boolean } = {}): Promise<{ attempted: number; sent: number }> {
  const now = new Date();
  // Business rule: send Fridays 9am local (server local). Skip otherwise unless force.
  if (!options.force) {
    const dow = now.getDay();
    const hour = now.getHours();
    if (dow !== 5 || hour < 9 || hour >= 11) {
      return { attempted: 0, sent: 0 };
    }
  }

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // Week ref id for idempotency (ISO date of week start).
  const weekRef = thisWeekStart.toISOString().slice(0, 10);

  const allUsers = await db.select().from(users);
  let attempted = 0;
  let sent = 0;
  for (const u of allUsers) {
    if (!u.email) continue;
    const prefs = await preferencesStore.getOrDefault(u.id);
    if (!prefs.digestEnabled) continue;
    attempted += 1;

    const weekAnalyses = await db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.userId, u.id),
          gte(analyses.createdAt, thisWeekStart),
          lt(analyses.createdAt, new Date(thisWeekStart.getTime() + 7 * 86400000))
        )
      );

    const prevAnalyses = await db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.userId, u.id),
          gte(analyses.createdAt, lastWeekStart),
          lt(analyses.createdAt, thisWeekStart)
        )
      );

    const digestItems: DigestDataAnalysis[] = weekAnalyses.map(a => ({
      id: a.id,
      accountName: a.accountName ?? undefined,
      createdAt: a.createdAt.toISOString(),
      intent: { primary: a.intent.primary, buyNow: a.intent.buyNow, buySoon: a.intent.buySoon },
      sellerPct: a.coaching?.talkRatio?.sellerPct ?? 0,
      questionScore: a.coaching?.questionScore?.score ?? 0,
    }));

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0);
    const avgTalk = avg(digestItems.map(d => d.sellerPct));
    const avgQ = avg(digestItems.map(d => d.questionScore));
    const prevAvgTalk = avg(prevAnalyses.map(a => a.coaching?.talkRatio?.sellerPct ?? 0));
    const weekOverWeekTalkDelta = prevAnalyses.length ? avgTalk - prevAvgTalk : null;

    const allBlockers = weekAnalyses.flatMap(a => a.blockers || []);
    const topBlocker = allBlockers[0];

    const allObservations = weekAnalyses.flatMap(a => a.coaching?.observations || []);
    const topTip = allObservations[0];

    const { subject, html, text } = renderWeeklyDigest({
      firstName: u.firstName || undefined,
      weekStart: thisWeekStart,
      analyses: digestItems,
      topBlocker,
      topTip,
      appUrl: appUrl(),
      avgTalkRatio: avgTalk,
      avgQuestionScore: avgQ,
      weekOverWeekTalkDelta,
    });

    const result = await sendEmail({
      to: u.email,
      subject,
      html,
      text,
      type: 'digest',
      userId: u.id,
      refId: `digest-${weekRef}`,
    });
    if (result.sent) sent += 1;
  }
  return { attempted, sent };
}
