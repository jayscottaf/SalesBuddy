import OpenAI from 'openai';
import type { SalesTranscriptAnalysisResponse } from '../../shared/schema';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';
const MAX_TRANSCRIPT_CHARS = 12000;

export interface QAExchange {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnalysisContext {
  analysis: SalesTranscriptAnalysisResponse;
  transcript?: string;
}

function buildContextBlock(ctx: AnalysisContext): string {
  const a = ctx.analysis;
  const lines: string[] = [];
  lines.push(`Account: ${a.accountName || 'Unknown'}`);
  lines.push(`Meeting date: ${a.meetingDate || 'Unknown'}`);
  lines.push(`Seller: ${a.sellerName || 'Unknown'}`);
  lines.push(`Participants: ${(a.participants || []).join(', ') || 'Unknown'}`);
  lines.push('');
  lines.push(`Summary: ${a.summary}`);
  lines.push(`Primary intent: ${a.intent.primary} (BuyNow ${a.intent.buyNow}% · BuySoon ${a.intent.buySoon}% · Later ${a.intent.later}% · NoFit ${a.intent.noFit}%)`);
  if (a.signals?.length) lines.push(`Signals: ${a.signals.join(' | ')}`);
  if (a.blockers?.length) lines.push(`Blockers: ${a.blockers.join(' | ')}`);
  if (a.nextSteps?.length) lines.push(`Next steps: ${a.nextSteps.join(' | ')}`);
  if (a.competitors?.length) {
    lines.push(`Competitors: ${a.competitors.map(c => `${c.name} (${c.sentiment})`).join(', ')}`);
  }
  lines.push(`Coaching: seller talk ${a.coaching.talkRatio.sellerPct}% · open question score ${a.coaching.questionScore.score}%`);
  if (ctx.transcript) {
    const truncated = ctx.transcript.length > MAX_TRANSCRIPT_CHARS
      ? ctx.transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n...[transcript truncated]'
      : ctx.transcript;
    lines.push('');
    lines.push('Transcript:');
    lines.push(truncated);
  } else {
    lines.push('');
    lines.push('(Full transcript not available for this analysis — answer using the structured fields above. If the answer requires transcript evidence you do not have, say so.)');
  }
  return lines.join('\n');
}

export const answerQuestion = async (
  ctx: AnalysisContext,
  history: QAExchange[],
  question: string
): Promise<string> => {
  if (!process.env.OPENAI_API_KEY) {
    return 'Q&A is unavailable: set OPENAI_API_KEY to enable conversational analysis.';
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `You are a concise sales-call analyst. Answer the user's question about a single meeting using the context provided. Rules:
- Keep answers short: 1-4 sentences unless a list is clearly needed.
- Quote the transcript directly when helpful; put quotes in double quotes.
- If the transcript is not available, say so explicitly when a question needs evidence beyond the structured analysis.
- Never invent facts. If unknown, say "Not mentioned in this meeting."
- No markdown headings. Lists are fine with hyphens.`;

  const contextBlock = buildContextBlock(ctx);

  const messages: any[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Context:\n${contextBlock}` },
  ];
  for (const h of history.slice(-8)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: question });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 600,
    messages,
  });
  return completion.choices[0]?.message?.content?.trim() || "I couldn't generate an answer — please try again.";
};
