import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { analysisStore } from './storage';
import { teamStore } from './teamStorage';
import { db } from './db';
import {
  feedback,
  users,
  type SalesTranscriptAnalysisRequest,
  type SalesTranscriptAnalysisResponse,
} from '../shared/schema';
import {
  analyzeTranscriptFallback,
  analyzeTranscriptWithAI,
  improveContent,
  getCoachingAdvice,
} from './ai/analysis';
import { answerQuestion } from './ai/qa';
import { qaStore } from './qaStore';
import { followUpStore } from './followUpStore';
import { preferencesStore } from './preferencesStore';
import { optionalAuth, requireAuth, resolveUser } from './auth/middleware';
import { registerMagicLinkRoutes } from './auth/routes';
import { rateLimit } from './rateLimit';
import { sendEmail } from './email/send';
import { renderFollowUpReady } from './email/templates';
import { startScheduler } from './jobs/scheduler';
import { sendWeeklyDigestsIfDue } from './jobs/weeklyDigest';
import { sendBlockerReminders } from './jobs/blockerReminder';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

const isReplit = !!process.env.REPL_ID;
const isDev = process.env.NODE_ENV !== 'production';

function appUrl(): string {
  const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000');
  return raw.replace(/\/+$/, '');
}

function blockerDueDate(): Date {
  // 14 days is the default blocker follow-up window. Stored so reminder job picks it up.
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
}

function extractRecipientEmailFromParticipants(participants?: string[]): string | undefined {
  if (!participants) return undefined;
  for (const p of participants) {
    const m = p.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (m) return m[1];
  }
  return undefined;
}

async function main() {
  app.set('trust proxy', 1);
  app.use(cors({ credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  if (isReplit) {
    // Set up Replit OIDC auth (/api/login, /api/callback, /api/logout).
    // We intentionally DO NOT call registerAuthRoutes — its /api/auth/user route
    // is incompatible with our unified session model. Our magic-link routes register
    // a session-aware /api/auth/user that works for both Replit and magic-link users.
    const { setupAuth } = require('./replit_integrations/auth');
    await setupAuth(app);
    if (isDev) {
      console.log('Running in development mode - magic-link + Replit auth enabled, dev bypass for local-only');
    }
  }

  // Magic-link routes always available (primary auth on Vercel, opt-in elsewhere).
  registerMagicLinkRoutes(app);

  // Resolve user for every request so downstream handlers can inspect req.user without requiring auth.
  app.use(resolveUser);

  const analysisLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyPrefix: 'analysis' });
  const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 120, keyPrefix: 'ai' });

  app.post('/api/sales/analysis', requireAuth, analysisLimiter, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const body = req.body as SalesTranscriptAnalysisRequest & { teamId?: string };
    if (!body?.transcript || typeof body.transcript !== 'string') {
      return res.status(400).json({ message: 'Transcript is required.' });
    }

    if (body.teamId) {
      const isMember = await teamStore.isMember(body.teamId, userId);
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this team.' });
      }
    }

    let analysisPayload: Omit<SalesTranscriptAnalysisResponse, 'id' | 'createdAt'>;
    try {
      if (!process.env.OPENAI_API_KEY) {
        analysisPayload = analyzeTranscriptFallback(body);
      } else {
        analysisPayload = await analyzeTranscriptWithAI(body);
      }
    } catch (error) {
      console.error('OpenAI analysis failed, using fallback:', error);
      analysisPayload = analyzeTranscriptFallback(body);
    }
    const analysis: SalesTranscriptAnalysisResponse = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...analysisPayload,
    };
    await analysisStore.save(analysis, userId, body.teamId, body.transcript);

    // Track blockers as follow-up tasks so the reminder job can nudge later.
    if (analysis.blockers?.length) {
      await followUpStore.createMany(
        analysis.blockers.map(b => ({
          analysisId: analysis.id,
          userId,
          teamId: body.teamId,
          accountName: analysis.accountName,
          type: 'blocker' as const,
          title: b,
          dueAt: blockerDueDate(),
        }))
      );
    }

    // Fire follow-up-ready email (async, don't block response).
    (async () => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user?.email) return;
        const prefs = await preferencesStore.getOrDefault(userId);
        if (!prefs.followUpEmailsEnabled) return;
        const recipient = extractRecipientEmailFromParticipants(analysis.participants);
        const { subject, html, text } = renderFollowUpReady({
          analysis,
          analysisUrl: `${appUrl()}/?analysisId=${encodeURIComponent(analysis.id)}`,
          recipientEmail: recipient,
        });
        await sendEmail({
          to: user.email,
          subject,
          html,
          text,
          type: 'followUpReady',
          userId,
          refId: analysis.id,
        });
      } catch (err) {
        console.error('follow-up email failed', err);
      }
    })();

    return res.json(analysis);
  });

  app.get('/api/sales/analysis', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const teamId = req.query.teamId as string | undefined;
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? Math.min(Number(limitRaw), 50) : 20;

    if (teamId) {
      const isMember = await teamStore.isMember(teamId, userId);
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this team.' });
      }
    }

    const results = await analysisStore.list(limit, userId, teamId);
    res.json(results);
  });

  app.get('/api/sales/analysis/:id', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const analysis = await analysisStore.get(req.params.id, userId);
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found.' });
    }
    return res.json(analysis);
  });

  app.post('/api/sales/improve', requireAuth, aiLimiter, async (req, res) => {
    const { content, type } = req.body as { content: string; type: 'email' | 'callScript' };
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required.' });
    }
    if (!type || !['email', 'callScript'].includes(type)) {
      return res.status(400).json({ message: 'Type must be "email" or "callScript".' });
    }

    try {
      const improved = await improveContent(content, type);
      return res.json({ improved });
    } catch (error) {
      console.error('AI improve failed:', error);
      return res.status(500).json({ message: 'Failed to improve content.' });
    }
  });

  app.post('/api/sales/coaching', requireAuth, aiLimiter, async (req, res) => {
    const { observation, sellerName, metrics } = req.body as {
      observation: string;
      sellerName?: string;
      metrics?: {
        talkRatio?: number;
        questionScore?: number;
        avgBuyLikelihood?: number;
      };
    };

    if (!observation || typeof observation !== 'string') {
      return res.status(400).json({ message: 'Observation is required.' });
    }

    try {
      const advice = await getCoachingAdvice(observation, sellerName, metrics);
      return res.json(advice);
    } catch (error) {
      console.error('Coaching advice failed:', error);
      return res.status(500).json({ message: 'Failed to get coaching advice.' });
    }
  });

  // --- Conversational Q&A ----------------------------------------------------
  app.get('/api/sales/analysis/:id/qa', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const record = await analysisStore.getWithTranscript(req.params.id);
    if (!record) return res.status(404).json({ message: 'Analysis not found.' });
    if (record.userId && record.userId !== userId) {
      if (!record.teamId || !(await teamStore.isMember(record.teamId, userId))) {
        return res.status(403).json({ message: 'Not allowed.' });
      }
    }
    const messages = await qaStore.list(req.params.id);
    res.json({ messages, hasTranscript: !!record.transcript });
  });

  app.post('/api/sales/analysis/:id/qa', requireAuth, aiLimiter, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { question } = req.body as { question?: string };
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'Question is required.' });
    }
    if (question.length > 1000) {
      return res.status(400).json({ message: 'Question too long.' });
    }
    const record = await analysisStore.getWithTranscript(req.params.id);
    if (!record) return res.status(404).json({ message: 'Analysis not found.' });
    if (record.userId && record.userId !== userId) {
      if (!record.teamId || !(await teamStore.isMember(record.teamId, userId))) {
        return res.status(403).json({ message: 'Not allowed.' });
      }
    }
    const history = await qaStore.list(req.params.id);
    try {
      const answer = await answerQuestion(
        { analysis: record.analysis, transcript: record.transcript || undefined },
        history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        question
      );
      await qaStore.append(req.params.id, userId, 'user', question);
      const saved = await qaStore.append(req.params.id, userId, 'assistant', answer);
      return res.json({ answer, id: saved.id });
    } catch (err) {
      console.error('qa failed', err);
      return res.status(500).json({ message: 'Q&A failed.' });
    }
  });

  // --- Follow-up tasks (blocker tracking) ------------------------------------
  app.get('/api/follow-ups', requireAuth, async (req: any, res) => {
    const tasks = await followUpStore.listForUser(req.user.claims.sub);
    res.json(tasks);
  });

  app.post('/api/follow-ups/:id/resolve', requireAuth, async (req: any, res) => {
    const ok = await followUpStore.resolve(req.params.id, req.user.claims.sub);
    if (!ok) return res.status(404).json({ message: 'Task not found.' });
    res.json({ ok: true });
  });

  // --- User preferences ------------------------------------------------------
  app.get('/api/preferences', requireAuth, async (req: any, res) => {
    const prefs = await preferencesStore.getOrDefault(req.user.claims.sub);
    res.json(prefs);
  });

  app.patch('/api/preferences', requireAuth, async (req: any, res) => {
    const body = req.body as {
      digestEnabled?: boolean;
      followUpEmailsEnabled?: boolean;
      blockerReminderDays?: number;
    };
    const prefs = await preferencesStore.upsert(req.user.claims.sub, body);
    res.json(prefs);
  });

  // --- Admin/debug: manually trigger jobs ------------------------------------
  if (isDev) {
    app.post('/api/admin/run-digest', requireAuth, async (_req, res) => {
      const r = await sendWeeklyDigestsIfDue({ force: true });
      res.json(r);
    });
    app.post('/api/admin/run-blocker-reminders', requireAuth, async (_req, res) => {
      const r = await sendBlockerReminders();
      res.json(r);
    });
  }

  app.post('/api/teams', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { name } = req.body as { name: string };
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Team name is required.' });
      }
      const team = await teamStore.create(name, userId);
      return res.json(team);
    } catch (error) {
      console.error('Create team failed:', error);
      return res.status(500).json({ message: 'Failed to create team. Database may not be configured.' });
    }
  });

  app.get('/api/teams', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teams = await teamStore.listForUser(userId);
      res.json(teams);
    } catch (error) {
      console.error('List teams failed:', error);
      return res.status(500).json({ message: 'Failed to fetch teams. Database may not be configured.' });
    }
  });

  app.post('/api/teams/:teamId/members', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { teamId } = req.params;
      const { email, role } = req.body as { email: string; role?: string };

      const team = await teamStore.get(teamId);
      if (!team || team.ownerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to add members.' });
      }

      const member = await teamStore.addMember(teamId, email, role || 'member');
      return res.json(member);
    } catch (error) {
      console.error('Add team member failed:', error);
      return res.status(500).json({ message: 'Failed to add team member.' });
    }
  });

  app.get('/api/teams/:teamId/members', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { teamId } = req.params;

      const isMember = await teamStore.isMember(teamId, userId);
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this team.' });
      }

      const members = await teamStore.getMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error('Get team members failed:', error);
      return res.status(500).json({ message: 'Failed to fetch team members.' });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/feedback', optionalAuth, async (req: any, res) => {
    try {
      const { type, message, email, page } = req.body as {
        type: string;
        message: string;
        email?: string;
        page?: string;
      };

      if (!type || !message) {
        return res.status(400).json({ message: 'Type and message are required.' });
      }

      const validTypes = ['bug', 'feature', 'general'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid feedback type.' });
      }

      const id = crypto.randomUUID();
      const userId = req.user?.claims?.sub || null;
      const userAgent = req.headers['user-agent'] || null;

      await db.insert(feedback).values({
        id,
        type,
        message,
        email: email || null,
        userId,
        page: page || null,
        userAgent,
      });

      return res.json({ success: true, id });
    } catch (error) {
      console.error('Submit feedback failed:', error);
      return res.status(500).json({ message: 'Failed to submit feedback.' });
    }
  });

  app.listen(port, () => {
    console.log(`Salesbuddy server running on http://localhost:${port}`);
    if (isDev) {
      console.log('Running in development mode - magic-link auth available, dev bypass for local');
    }
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY not set; using fallback analysis.');
    }
    if (!process.env.RESEND_API_KEY) {
      console.log('RESEND_API_KEY not set; emails will be logged but not delivered.');
    }
    startScheduler();
  });
}

main().catch(console.error);
