import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from '../../_lib/db';
import { teamMembers, users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { teamId } = req.query;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ message: 'Team ID is required.' });
  }

  const db = getDb();

  if (!db) {
    return res.status(503).json({ message: 'Database not configured.' });
  }

  // GET /api/teams/[teamId]/members - list team members
  if (req.method === 'GET') {
    try {
      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      return res.json(members);
    } catch (error) {
      console.error('Get team members failed:', error);
      return res.status(500).json({ message: 'Failed to fetch team members.' });
    }
  }

  // POST /api/teams/[teamId]/members - add team member
  if (req.method === 'POST') {
    try {
      const { email, role } = req.body as { email: string; role?: string };

      if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
      }

      // Look up user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (!user) {
        return res.status(404).json({ message: 'User not found with that email.' });
      }

      const [member] = await db
        .insert(teamMembers)
        .values({
          id: crypto.randomUUID(),
          teamId,
          userId: user.id,
          role: role || 'member',
        })
        .returning();

      return res.json(member);
    } catch (error) {
      console.error('Add team member failed:', error);
      return res.status(500).json({ message: 'Failed to add team member.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
