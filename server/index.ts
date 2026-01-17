import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { analysisStore } from './storage';
import { teamStore } from './teamStorage';
import type {
  SalesTranscriptAnalysisRequest,
  SalesTranscriptAnalysisResponse,
} from '../shared/schema';
import {
  analyzeTranscriptFallback,
  analyzeTranscriptWithAI,
  improveContent,
  getCoachingAdvice,
} from './ai/analysis';
import { setupAuth, registerAuthRoutes, isAuthenticated } from './replit_integrations/auth';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

const isDev = process.env.NODE_ENV !== 'production';
const DEV_USER_ID = 'dev-user-id';

const optionalAuth: express.RequestHandler = (req, res, next) => {
  if (isDev && !req.isAuthenticated?.()) {
    (req as any).user = { claims: { sub: DEV_USER_ID } };
  }
  next();
};

const requireAuth: express.RequestHandler = (req, res, next) => {
  if (isDev) {
    if (!req.isAuthenticated?.()) {
      (req as any).user = { claims: { sub: DEV_USER_ID } };
    }
    return next();
  }
  return isAuthenticated(req, res, next);
};

async function main() {
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  await setupAuth(app);
  registerAuthRoutes(app);

  app.post('/api/sales/analysis', requireAuth, async (req: any, res) => {
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
    await analysisStore.save(analysis, userId, body.teamId);
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

  app.post('/api/sales/improve', requireAuth, async (req, res) => {
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

  app.post('/api/sales/coaching', requireAuth, async (req, res) => {
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

  app.post('/api/teams', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { name } = req.body as { name: string };
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Team name is required.' });
    }
    const team = await teamStore.create(name, userId);
    return res.json(team);
  });

  app.get('/api/teams', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const teams = await teamStore.listForUser(userId);
    res.json(teams);
  });

  app.post('/api/teams/:teamId/members', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { teamId } = req.params;
    const { email, role } = req.body as { email: string; role?: string };
    
    const team = await teamStore.get(teamId);
    if (!team || team.ownerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to add members.' });
    }
    
    const member = await teamStore.addMember(teamId, email, role || 'member');
    return res.json(member);
  });

  app.get('/api/teams/:teamId/members', requireAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { teamId } = req.params;
    
    const isMember = await teamStore.isMember(teamId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this team.' });
    }
    
    const members = await teamStore.getMembers(teamId);
    res.json(members);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(port, () => {
    console.log(`Salesbuddy server running on http://localhost:${port}`);
    if (isDev) {
      console.log('Running in development mode - auth bypass enabled');
    }
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY not set; using fallback analysis.');
    }
  });
}

main().catch(console.error);
