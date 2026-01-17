import type { VercelRequest, VercelResponse } from '@vercel/node';
import { improveContent } from '../../server/ai/analysis';

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
}
