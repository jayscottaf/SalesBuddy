# Salesbuddy

Sales meeting transcript analysis with AI-powered coaching. Paste a call transcript → get intent scoring, blockers, next steps, coaching metrics, competitor insight, a drafted follow-up email and call script, and a conversational Q&A panel.

## Stack

- **Frontend:** React 19 + Vite (`client/`)
- **Backend:** Express 5 + Drizzle ORM (`server/`) packaged as a single Vercel serverless function (`api/index.ts`)
- **Database:** Postgres (any provider — Neon, Supabase, Railway, RDS, etc.)
- **Auth:** Magic-link email sign-in (signed cookies, no Redis needed)
- **Email:** Resend (graceful no-op fallback when unset)
- **Rate limiting:** Upstash Redis via `@upstash/ratelimit`
- **Background jobs:** Vercel Cron → HTTP endpoints on the serverless function

## Project layout

```
client/             Vite SPA
server/
  app.ts            Builds the Express app (shared between local + serverless)
  index.ts          Local dev entrypoint — starts setInterval scheduler
  auth/             Magic-link sign-in, signed-cookie sessions
  email/            Resend client + HTML templates
  jobs/             weeklyDigest, blockerReminder, scheduler (local-only)
  ai/               OpenAI analysis + Q&A
api/index.ts        Vercel serverless entrypoint — wraps createApp()
shared/schema.ts    Drizzle table definitions + shared TS types
vercel.json         Build, rewrites, cron schedule
```

## Environment variables

| Var                         | Required | Notes |
|-----------------------------|----------|-------|
| `DATABASE_URL`              | yes      | Postgres connection string |
| `SESSION_SECRET`            | yes      | Signs the magic-link session cookie — any long random string |
| `APP_URL`                   | yes      | Public URL used in emails (`https://app.example.com`) |
| `OPENAI_API_KEY`            | no       | If unset, the app uses deterministic fallback analysis |
| `OPENAI_MODEL`              | no       | Defaults to `gpt-5.3` |
| `RESEND_API_KEY`            | no       | If unset, emails are logged to stdout instead of sent |
| `EMAIL_FROM`                | no       | e.g. `Salesbuddy <no-reply@yourdomain.com>` |
| `UPSTASH_REDIS_REST_URL`    | prod     | Required in prod for rate limiting to actually limit. `KV_REST_API_URL` is also accepted (Vercel's marketplace integration sometimes injects that name instead). |
| `UPSTASH_REDIS_REST_TOKEN`  | prod     | Companion token. `KV_REST_API_TOKEN` is also accepted. |
| `CRON_SECRET`               | prod     | Vercel Cron sends it as `Authorization: Bearer <secret>` |

## Local development

```
npm install
cd server && npm install
cd ../client && npm install
npm run db:push          # applies Drizzle schema to DATABASE_URL
npm run dev              # runs Vite on :5000 and Express on :3001
```

Vite proxies `/api/*` to `:3001`. In development, unauthenticated requests are bypassed with a fake `dev-user-id` so you don't need to send yourself magic links every time. Set `DISABLE_DEV_BYPASS=1` to force real sign-in locally.

Manual job triggers (dev only):
```
curl -X POST http://localhost:3001/api/admin/run-digest -b sb_session=...
curl -X POST http://localhost:3001/api/admin/run-blocker-reminders -b sb_session=...
```

## Vercel deployment

1. Import the repo into Vercel.
2. In **Settings → Environment Variables**, set every `prod` / `yes` row from the table above.
3. Set up Postgres (Neon/Supabase/Railway) and run `npm run db:push` locally once against the prod URL — the schema is the same.
4. Set up an Upstash Redis DB (free tier) and copy the REST URL + token.
5. Add your Resend domain and verify it.
6. Deploy. Vercel will:
   - Build the client with `client/npm run build` → `client/dist`
   - Bundle `api/index.ts` as a serverless function that serves `/api/*`
   - Schedule the two cron jobs from `vercel.json`:
     - `/api/cron/weekly-digest` Fridays at 14:00 UTC (9am ET)
     - `/api/cron/blocker-reminders` every 6 hours

Cron endpoints check `Authorization: Bearer $CRON_SECRET` — Vercel supplies this automatically when the env var is set.

## Database schema

Managed by Drizzle Kit. Key tables: `users`, `analyses`, `teams`, `team_members`, `feedback`, `magic_link_tokens`, `follow_up_tasks`, `email_log`, `qa_messages`, `user_preferences`. Apply changes with `npm run db:push`.

## Notes on retention features

- `/api/sales/analysis` POST creates `follow_up_tasks` for every blocker in the analysis, due 14 days out. The blocker-reminder cron nudges the rep by email when those come due.
- When an analysis completes, a "Your follow-up is ready" email is sent to the rep with a drafted email and one-click Gmail/Outlook compose links. Idempotent via `email_log(refId=analysisId)`.
- The weekly digest cron runs hourly idempotency-checked; if you need to test outside Friday, POST to `/api/admin/run-digest` in dev.
- Conversational Q&A at `/api/sales/analysis/:id/qa` answers grounded in the stored transcript. Transcripts created before this feature shipped will show "Summary-only mode" in the UI.
