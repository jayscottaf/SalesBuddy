import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from './_lib/db';
import { getAuthenticatedUser } from './_lib/auth';
import { feedback } from '../shared/schema';
import { desc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET /api/feedback - list all feedback (admin only, for now just authenticated)
  if (req.method === 'GET') {
    try {
      const db = getDb();
      if (!db) {
        return res.json([]);
      }

      const feedbackList = await db
        .select()
        .from(feedback)
        .orderBy(desc(feedback.createdAt));

      return res.json(feedbackList);
    } catch (error) {
      console.error('Get feedback failed:', error);
      return res.json([]);
    }
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

    // Try to get authenticated user (optional - feedback can be anonymous)
    const user = await getAuthenticatedUser(req);

    // Check if database is configured
    if (!db) {
      // Log feedback to console if no database
      console.log('FEEDBACK RECEIVED:', {
        type,
        message,
        email,
        page,
        userId: user?.id,
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
      userId: user?.id || null,
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
