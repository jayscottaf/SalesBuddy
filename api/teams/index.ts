import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Note: Teams functionality requires database setup.
// For now, return empty array to prevent errors.
// Full implementation requires DATABASE_URL to be configured in Vercel.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET /api/teams - list teams
  if (req.method === 'GET') {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        // Return empty array if no database - teams feature not available
        return res.json([]);
      }

      // Dynamic import to avoid errors when DATABASE_URL is not set
      const { db } = await import('../../server/db');
      const { teams, teamMembers } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

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

      const { or } = await import('drizzle-orm');
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
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ message: 'Database not configured. Teams feature unavailable.' });
      }

      const { name } = req.body as { name: string };
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Team name is required.' });
      }

      const { db } = await import('../../server/db');
      const { teams, teamMembers } = await import('../../shared/schema');

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
