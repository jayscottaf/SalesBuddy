-- Salesbuddy Tier 1 schema changes.
-- Safe to run on an existing database that already has users/teams/analyses/feedback.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS on add column).

-- 1. Store the transcript alongside each analysis so Q&A can cite it.
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS transcript TEXT;

-- 2. Magic-link sign-in tokens (replaces Replit Auth).
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id           VARCHAR(36)  PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  token_hash   VARCHAR(128) NOT NULL,
  expires_at   TIMESTAMP    NOT NULL,
  used_at      TIMESTAMP,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS magic_link_tokens_token_hash_idx ON magic_link_tokens (token_hash);
CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx       ON magic_link_tokens (email);

-- 3. Per-user email/notification preferences.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                  VARCHAR(255) PRIMARY KEY,
  digest_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  follow_up_emails_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
  blocker_reminder_days    INTEGER      NOT NULL DEFAULT 14,
  updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 4. Follow-up tasks (blockers + next steps) the reminder job nudges on.
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id              VARCHAR(36)  PRIMARY KEY,
  analysis_id     VARCHAR(36)  NOT NULL,
  user_id         VARCHAR(255),
  team_id         VARCHAR(36),
  account_name    VARCHAR(255),
  type            VARCHAR(50)  NOT NULL,                  -- 'blocker' | 'nextStep'
  title           TEXT         NOT NULL,
  status          VARCHAR(50)  NOT NULL DEFAULT 'open',   -- 'open' | 'resolved' | 'snoozed'
  due_at          TIMESTAMP,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMP,
  last_reminder_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS follow_up_tasks_user_status_idx ON follow_up_tasks (user_id, status);
CREATE INDEX IF NOT EXISTS follow_up_tasks_due_open_idx    ON follow_up_tasks (status, type, due_at);

-- 5. Idempotent record of emails sent (prevents duplicate digests/reminders).
CREATE TABLE IF NOT EXISTS email_log (
  id       VARCHAR(36)  PRIMARY KEY,
  user_id  VARCHAR(255),
  email    VARCHAR(255) NOT NULL,
  type     VARCHAR(50)  NOT NULL, -- 'digest' | 'followUpReady' | 'blockerReminder' | 'magicLink'
  ref_id   VARCHAR(100),
  sent_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_log_dedupe_idx ON email_log (type, ref_id, email);

-- 6. Conversational Q&A messages tied to an analysis.
CREATE TABLE IF NOT EXISTS qa_messages (
  id           VARCHAR(36)  PRIMARY KEY,
  analysis_id  VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(255),
  role         VARCHAR(20)  NOT NULL, -- 'user' | 'assistant'
  content      TEXT         NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qa_messages_analysis_created_idx ON qa_messages (analysis_id, created_at);

-- Optional cleanup (non-destructive — uncomment only when you're sure no
-- Replit-auth sessions still need to be preserved):
-- DROP TABLE IF EXISTS sessions;
