import { pgTable, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;
