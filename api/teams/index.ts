import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from '../_lib/db';
import { teams, teamMembers } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = getDb();

  // GET /api/teams - list teams
  if (req.method === 'GET') {
    try {
      // Check if database is configured
      if (!db) {
        return res.json([]);
      }

      // For now, return all teams (no auth in serverless)
      // In production, you'd verify the user from a session/token
      const DEV_USER_ID = 'dev-user-id';

      const memberTeamIds = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, DEV_USER_ID));

      if (memberTeamIds.length === 0) {
        return res.json([]);
      }

      const teamIds = memberTeamIds.map((m) => m.teamId);
      const result = await db
        .select()
        .from(teams)
        .where(or(...teamIds.map((id) => eq(teams.id, id))));

      return res.json(result);
    } catch (error) {
      console.error('List teams failed:', error);
      return res.json([]); // Return empty array on error
    }
  }

  // POST /api/teams - create team
  if (req.method === 'POST') {
    try {
      if (!db) {
        return res.status(503).json({ message: 'Database not configured. Teams feature unavailable.' });
      }

      const { name } = req.body as { name: string };
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Team name is required.' });
      }

      const DEV_USER_ID = 'dev-user-id';
      const id = crypto.randomUUID();

      const [team] = await db
        .insert(teams)
        .values({ id, name, ownerId: DEV_USER_ID })
        .returning();

      await db.insert(teamMembers).values({
        id: crypto.randomUUID(),
        teamId: id,
        userId: DEV_USER_ID,
        role: 'owner',
      });

      return res.json(team);
    } catch (error) {
      console.error('Create team failed:', error);
      return res.status(500).json({ message: 'Failed to create team. Database may not be configured.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
