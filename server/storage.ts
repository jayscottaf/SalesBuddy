import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  analyses,
  type SalesTranscriptAnalysisListItem,
  type SalesTranscriptAnalysisResponse,
} from "../shared/schema";

export const analysisStore = {
  save: async (analysis: SalesTranscriptAnalysisResponse): Promise<SalesTranscriptAnalysisResponse> => {
    await db.insert(analyses).values({
      id: analysis.id,
      meetingDate: analysis.meetingDate,
      accountName: analysis.accountName,
      participants: analysis.participants,
      sellerName: analysis.sellerName,
      notes: analysis.notes,
      summary: analysis.summary,
      intent: analysis.intent,
      signals: analysis.signals,
      blockers: analysis.blockers,
      nextSteps: analysis.nextSteps,
      followUp: analysis.followUp,
      coaching: analysis.coaching,
      competitors: analysis.competitors,
      competitorInsights: analysis.competitorInsights,
    });
    return analysis;
  },

  list: async (limit: number = 20): Promise<SalesTranscriptAnalysisListItem[]> => {
    const results = await db
      .select({
        id: analyses.id,
        createdAt: analyses.createdAt,
        meetingDate: analyses.meetingDate,
        accountName: analyses.accountName,
        summary: analyses.summary,
        intent: analyses.intent,
      })
      .from(analyses)
      .orderBy(desc(analyses.createdAt))
      .limit(limit);

    return results.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      meetingDate: item.meetingDate ?? undefined,
      accountName: item.accountName ?? undefined,
      summary: item.summary,
      intent: item.intent,
    }));
  },

  get: async (id: string): Promise<SalesTranscriptAnalysisResponse | undefined> => {
    const [result] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, id));

    if (!result) return undefined;

    return {
      id: result.id,
      createdAt: result.createdAt.toISOString(),
      meetingDate: result.meetingDate ?? undefined,
      accountName: result.accountName ?? undefined,
      participants: result.participants ?? undefined,
      sellerName: result.sellerName ?? undefined,
      notes: result.notes ?? undefined,
      summary: result.summary,
      intent: result.intent,
      signals: result.signals,
      blockers: result.blockers,
      nextSteps: result.nextSteps,
      followUp: result.followUp,
      coaching: result.coaching,
      competitors: result.competitors ?? undefined,
      competitorInsights: result.competitorInsights ?? undefined,
    };
  },
};
