import { eq, desc, or, and } from "drizzle-orm";
import { db } from "./db";
import {
  analyses,
  teamMembers,
  type SalesTranscriptAnalysisListItem,
  type SalesTranscriptAnalysisResponse,
} from "../shared/schema";

export const analysisStore = {
  save: async (
    analysis: SalesTranscriptAnalysisResponse,
    userId?: string,
    teamId?: string
  ): Promise<SalesTranscriptAnalysisResponse> => {
    await db.insert(analyses).values({
      id: analysis.id,
      userId,
      teamId,
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

  list: async (
    limit: number = 20,
    userId?: string,
    teamId?: string
  ): Promise<SalesTranscriptAnalysisListItem[]> => {
    let query = db
      .select({
        id: analyses.id,
        createdAt: analyses.createdAt,
        meetingDate: analyses.meetingDate,
        accountName: analyses.accountName,
        summary: analyses.summary,
        intent: analyses.intent,
      })
      .from(analyses);

    if (teamId) {
      query = query.where(eq(analyses.teamId, teamId)) as typeof query;
    } else if (userId) {
      const userTeams = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId));

      const teamIds = userTeams.map((t) => t.teamId);

      if (teamIds.length > 0) {
        query = query.where(
          or(
            eq(analyses.userId, userId),
            ...teamIds.map((tid) => eq(analyses.teamId, tid))
          )
        ) as typeof query;
      } else {
        query = query.where(eq(analyses.userId, userId)) as typeof query;
      }
    }

    const results = await query
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

  get: async (
    id: string,
    userId?: string
  ): Promise<SalesTranscriptAnalysisResponse | undefined> => {
    const [result] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, id));

    if (!result) return undefined;

    if (userId && result.userId !== userId) {
      if (result.teamId) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, result.teamId),
              eq(teamMembers.userId, userId)
            )
          );
        if (!membership) return undefined;
      } else {
        return undefined;
      }
    }

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
