import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCoachingAdvice } from '../../server/ai/analysis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
}
