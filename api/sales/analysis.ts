import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import type {
  SalesTranscriptAnalysisRequest,
  SalesTranscriptAnalysisResponse,
} from '../../shared/schema';
import {
  analyzeTranscriptFallback,
  analyzeTranscriptWithAI,
} from '../../server/ai/analysis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
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

    return res.json(analysis);
  }

  // GET - return empty array (storage is client-side only in Vercel deployment)
  if (req.method === 'GET') {
    return res.json([]);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
