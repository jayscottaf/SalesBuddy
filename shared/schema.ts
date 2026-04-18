import { pgTable, varchar, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";

export * from "./models/auth";

export type IntentBucket = 'BuyNow' | 'BuySoon' | 'Later' | 'NoFit';

export interface IntentScore {
  buyNow: number;
  buySoon: number;
  later: number;
  noFit: number;
  primary: IntentBucket;
}

export interface FollowUp {
  timing: string;
  emailDraft: string;
  callScript: string;
}

export interface CoachingMetrics {
  talkRatio: {
    sellerPct: number;
    customerPct: number;
    sellerWords: number;
    customerWords: number;
  };
  questionScore: {
    sellerQuestions: number;
    openQuestions: number;
    score: number;
  };
  observations: string[];
}

export type CompetitorSentiment = 'positive' | 'negative' | 'neutral';

export interface CompetitorMention {
  name: string;
  context: string;
  sentiment: CompetitorSentiment;
  quote: string;
}

export interface CompetitorInsights {
  topThreat?: string;
  positioning: string[];
}

export interface SalesTranscriptAnalysisRequest {
  transcript: string;
  meetingDate?: string;
  accountName?: string;
  participants?: string[];
  sellerName?: string;
  notes?: string;
}

export interface SalesTranscriptAnalysisResponse {
  id: string;
  createdAt: string;
  meetingDate?: string;
  accountName?: string;
  participants?: string[];
  sellerName?: string;
  notes?: string;
  summary: string;
  intent: IntentScore;
  signals: string[];
  blockers: string[];
  nextSteps: string[];
  followUp: FollowUp;
  coaching: CoachingMetrics;
  competitors?: CompetitorMention[];
  competitorInsights?: CompetitorInsights;
}

export interface SalesTranscriptAnalysisListItem {
  id: string;
  createdAt: string;
  meetingDate?: string;
  accountName?: string;
  summary: string;
  intent: IntentScore;
}

export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  ownerId: varchar("owner_id", { length: 255 }).notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: varchar("id", { length: 36 }).primaryKey(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const analyses = pgTable("analyses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: varchar("user_id", { length: 255 }),
  teamId: varchar("team_id", { length: 36 }),
  meetingDate: varchar("meeting_date", { length: 50 }),
  accountName: varchar("account_name", { length: 255 }),
  participants: jsonb("participants").$type<string[]>(),
  sellerName: varchar("seller_name", { length: 255 }),
  notes: text("notes"),
  transcript: text("transcript"),
  summary: text("summary").notNull(),
  intent: jsonb("intent").$type<IntentScore>().notNull(),
  signals: jsonb("signals").$type<string[]>().notNull(),
  blockers: jsonb("blockers").$type<string[]>().notNull(),
  nextSteps: jsonb("next_steps").$type<string[]>().notNull(),
  followUp: jsonb("follow_up").$type<FollowUp>().notNull(),
  coaching: jsonb("coaching").$type<CoachingMetrics>().notNull(),
  competitors: jsonb("competitors").$type<CompetitorMention[]>(),
  competitorInsights: jsonb("competitor_insights").$type<CompetitorInsights>(),
});

// Magic link tokens for email-based auth (used on Vercel where Replit Auth isn't available)
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Per-user email/notification preferences
export const userPreferences = pgTable("user_preferences", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
  followUpEmailsEnabled: boolean("follow_up_emails_enabled").notNull().default(true),
  blockerReminderDays: integer("blocker_reminder_days").notNull().default(14),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Follow-up tasks (blockers + next steps) tracked for reminder nudges
export const followUpTasks = pgTable("follow_up_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  analysisId: varchar("analysis_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }),
  teamId: varchar("team_id", { length: 36 }),
  accountName: varchar("account_name", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull(), // 'blocker' | 'nextStep'
  title: text("title").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("open"), // 'open' | 'resolved' | 'snoozed'
  dueAt: timestamp("due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  lastReminderAt: timestamp("last_reminder_at"),
});

// Idempotent record of emails we've sent (prevents duplicate digests/reminders)
export const emailLog = pgTable("email_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'digest' | 'followUpReady' | 'blockerReminder' | 'magicLink'
  refId: varchar("ref_id", { length: 100 }), // analysisId, taskId, or digest week
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

// Conversational Q&A messages tied to an analysis
export const qaMessages = pgTable("qa_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  analysisId: varchar("analysis_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
  id: varchar("id", { length: 36 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'bug' | 'feature' | 'general'
  message: text("message").notNull(),
  email: varchar("email", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  page: varchar("page", { length: 255 }),
  userAgent: text("user_agent"),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = typeof magicLinkTokens.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
export type FollowUpTask = typeof followUpTasks.$inferSelect;
export type InsertFollowUpTask = typeof followUpTasks.$inferInsert;
export type EmailLog = typeof emailLog.$inferSelect;
export type InsertEmailLog = typeof emailLog.$inferInsert;
export type QAMessage = typeof qaMessages.$inferSelect;
export type InsertQAMessage = typeof qaMessages.$inferInsert;
