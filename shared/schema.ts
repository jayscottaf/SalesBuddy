import { pgTable, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";

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

export const analyses = pgTable("analyses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;
