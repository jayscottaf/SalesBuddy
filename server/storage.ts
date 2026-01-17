import type {
  SalesTranscriptAnalysisListItem,
  SalesTranscriptAnalysisResponse,
} from '../shared/schema';

const analyses: SalesTranscriptAnalysisResponse[] = [];

export const analysisStore = {
  save: (analysis: SalesTranscriptAnalysisResponse) => {
    analyses.unshift(analysis);
    return analysis;
  },
  list: (limit: number = 20): SalesTranscriptAnalysisListItem[] =>
    analyses.slice(0, limit).map(item => ({
      id: item.id,
      createdAt: item.createdAt,
      meetingDate: item.meetingDate,
      accountName: item.accountName,
      summary: item.summary,
      intent: item.intent,
    })),
  get: (id: string) => analyses.find(item => item.id === id),
};
