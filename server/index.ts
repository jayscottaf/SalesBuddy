import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { analysisStore } from './storage';
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

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/api/sales/analysis', async (req, res) => {
  const body = req.body as SalesTranscriptAnalysisRequest;
  if (!body?.transcript || typeof body.transcript !== 'string') {
    return res.status(400).json({ message: 'Transcript is required.' });
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
  await analysisStore.save(analysis);
  return res.json(analysis);
});

app.get('/api/sales/analysis', async (req, res) => {
  const limitRaw = req.query.limit as string | undefined;
  const limit = limitRaw ? Math.min(Number(limitRaw), 50) : 20;
  const results = await analysisStore.list(limit);
  res.json(results);
});

app.get('/api/sales/analysis/:id', async (req, res) => {
  const analysis = await analysisStore.get(req.params.id);
  if (!analysis) {
    return res.status(404).json({ message: 'Analysis not found.' });
  }
  return res.json(analysis);
});

app.post('/api/sales/improve', async (req, res) => {
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

app.post('/api/sales/coaching', async (req, res) => {
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Salesbuddy server running on http://localhost:${port}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY not set; using fallback analysis.');
  }
});
