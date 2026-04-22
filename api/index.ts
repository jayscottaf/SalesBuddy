// Vercel serverless entrypoint. Wraps the whole Express app as a single function.
// vercel.json rewrites /api/(.*) to this handler. Cron endpoints
// (/api/cron/*) live in sibling files and are matched first by Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/app';

const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as any)(req, res);
}
