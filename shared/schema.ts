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
}

export interface SalesTranscriptAnalysisListItem {
  id: string;
  createdAt: string;
  meetingDate?: string;
  accountName?: string;
  summary: string;
  intent: IntentScore;
}
