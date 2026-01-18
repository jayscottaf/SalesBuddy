import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from './_lib/db';
import { feedback } from '../shared/schema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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

    const db = getDb();

    // Check if database is configured
    if (!db) {
      // Log feedback to console if no database
      console.log('FEEDBACK RECEIVED:', {
        type,
        message,
        email,
        page,
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, id: crypto.randomUUID(), note: 'Logged to console (no database)' });
    }

    // Save to database
    const id = crypto.randomUUID();
    const userAgent = req.headers['user-agent'] || null;

    await db.insert(feedback).values({
      id,
      type,
      message,
      email: email || null,
      userId: null, // No auth in serverless mode
      page: page || null,
      userAgent,
    });

    return res.json({ success: true, id });
  } catch (error) {
    console.error('Submit feedback failed:', error);
    // Still log to console on error
    console.log('FEEDBACK (fallback log):', req.body);
    return res.json({ success: true, note: 'Logged to console (database error)' });
  }
}
