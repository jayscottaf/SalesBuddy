import { createApp } from './app';
import { startScheduler } from './jobs/scheduler';

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const isDev = process.env.NODE_ENV !== 'production';

const app = createApp();

app.listen(port, () => {
  console.log(`Salesbuddy server running on http://localhost:${port}`);
  if (isDev) {
    console.log('Running in development mode - magic-link auth available, dev bypass for local');
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY not set; using fallback analysis.');
  }
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set; emails will be logged but not delivered.');
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.log('UPSTASH_REDIS_REST_URL not set; rate limiting disabled (dev only).');
  }
  // Scheduler only runs when we have a persistent process (local dev or a non-serverless host).
  // On Vercel, jobs are driven by cron endpoints instead.
  if (!process.env.VERCEL) {
    startScheduler();
  }
});
