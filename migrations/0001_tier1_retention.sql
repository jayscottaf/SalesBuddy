-- Salesbuddy full-schema migration.
-- Idempotent: every statement is IF NOT EXISTS, safe to re-run on any DB state
-- (fresh DB, partially-applied, or already complete). Mirrors shared/schema.ts
-- and shared/models/auth.ts exactly.

-- 1. Users (created/upserted when a magic link is consumed).
CREATE TABLE IF NOT EXISTS users (
  id                VARCHAR      PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR      UNIQUE,
  first_name        VARCHAR,
  last_name         VARCHAR,
  profile_image_url VARCHAR,
  created_at        TIMESTAMP    DEFAULT NOW(),
  updated_at        TIMESTAMP    DEFAULT NOW()
);

-- 2. Teams + membership.
CREATE TABLE IF NOT EXISTS teams (
  id         VARCHAR(36)  PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  owner_id   VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id        VARCHAR(36)  PRIMARY KEY,
  team_id   VARCHAR(36)  NOT NULL,
  user_id   VARCHAR(255) NOT NULL,
  role      VARCHAR(50)  NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS team_members_team_user_idx ON team_members (team_id, user_id);

-- 3. Analyses (meeting transcript results). Transcript is stored so Q&A can cite it.
CREATE TABLE IF NOT EXISTS analyses (
  id                  VARCHAR(36)  PRIMARY KEY,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  user_id             VARCHAR(255),
  team_id             VARCHAR(36),
  meeting_date        VARCHAR(50),
  account_name        VARCHAR(255),
  participants        JSONB,
  seller_name         VARCHAR(255),
  notes               TEXT,
  transcript          TEXT,
  summary             TEXT         NOT NULL,
  intent              JSONB        NOT NULL,
  signals             JSONB        NOT NULL,
  blockers            JSONB        NOT NULL,
  next_steps          JSONB        NOT NULL,
  follow_up           JSONB        NOT NULL,
  coaching            JSONB        NOT NULL,
  competitors         JSONB,
  competitor_insights JSONB
);
CREATE INDEX IF NOT EXISTS analyses_user_created_idx ON analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analyses_team_created_idx ON analyses (team_id, created_at DESC);

-- 4. Magic-link sign-in tokens.
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id         VARCHAR(36)  PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS magic_link_tokens_token_hash_idx ON magic_link_tokens (token_hash);
CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx      ON magic_link_tokens (email);

-- 5. Per-user email/notification preferences.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                  VARCHAR(255) PRIMARY KEY,
  digest_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  follow_up_emails_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
  blocker_reminder_days    INTEGER      NOT NULL DEFAULT 14,
  updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 6. Follow-up tasks the reminder job nudges on.
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id               VARCHAR(36)  PRIMARY KEY,
  analysis_id      VARCHAR(36)  NOT NULL,
  user_id          VARCHAR(255),
  team_id          VARCHAR(36),
  account_name     VARCHAR(255),
  type             VARCHAR(50)  NOT NULL,                 -- 'blocker' | 'nextStep'
  title            TEXT         NOT NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'open',  -- 'open' | 'resolved' | 'snoozed'
  due_at           TIMESTAMP,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMP,
  last_reminder_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS follow_up_tasks_user_status_idx ON follow_up_tasks (user_id, status);
CREATE INDEX IF NOT EXISTS follow_up_tasks_due_open_idx    ON follow_up_tasks (status, type, due_at);

-- 7. Idempotency log for outbound email (prevents duplicate digests/reminders).
CREATE TABLE IF NOT EXISTS email_log (
  id      VARCHAR(36)  PRIMARY KEY,
  user_id VARCHAR(255),
  email   VARCHAR(255) NOT NULL,
  type    VARCHAR(50)  NOT NULL, -- 'digest' | 'followUpReady' | 'blockerReminder' | 'magicLink'
  ref_id  VARCHAR(100),
  sent_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_log_dedupe_idx ON email_log (type, ref_id, email);

-- 8. Conversational Q&A messages tied to an analysis.
CREATE TABLE IF NOT EXISTS qa_messages (
  id          VARCHAR(36)  PRIMARY KEY,
  analysis_id VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(255),
  role        VARCHAR(20)  NOT NULL,               -- 'user' | 'assistant'
  content     TEXT         NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qa_messages_analysis_created_idx ON qa_messages (analysis_id, created_at);

-- 9. In-product feedback widget submissions.
CREATE TABLE IF NOT EXISTS feedback (
  id         VARCHAR(36)  PRIMARY KEY,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  type       VARCHAR(50)  NOT NULL, -- 'bug' | 'feature' | 'general'
  message    TEXT         NOT NULL,
  email      VARCHAR(255),
  user_id    VARCHAR(255),
  page       VARCHAR(255),
  user_agent TEXT
);

-- Quick sanity query (optional, uncomment to run):
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
