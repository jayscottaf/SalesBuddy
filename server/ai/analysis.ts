import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import type {
  CoachingMetrics,
  CompetitorMention,
  CompetitorInsights,
  SalesTranscriptAnalysisRequest,
  SalesTranscriptAnalysisResponse,
} from '../../shared/schema';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPEN_QUESTION_HINTS = [
  'what',
  'how',
  'why',
  'tell me',
  'walk me',
  'help me understand',
  'can you share',
  'could you describe',
];

const SELLER_ROLE_HINTS = ['sales rep', 'account executive', 'ae', 'seller', 'host', 'presenter'];
const CUSTOMER_ROLE_HINTS = ['customer', 'client', 'prospect', 'buyer', 'cto', 'cfo', 'ceo', 'vp', 'director', 'manager', 'admin', 'engineer', 'analyst'];

const extractUtterances = (transcript: string) => {
  return transcript
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([^:]{1,50}):\s*(.+)$/);
      if (!match) {
        return { speaker: 'unknown', text: line };
      }
      return { speaker: match[1].trim(), text: match[2].trim() };
    });
};

const detectSpeakerRole = (
  speaker: string,
  sellerName?: string
) => {
  const normalized = speaker.trim().toLowerCase();

  // Direct seller name match
  if (sellerName && normalized.includes(sellerName.toLowerCase())) {
    return 'seller';
  }

  // Check for seller role hints
  if (SELLER_ROLE_HINTS.some(hint => normalized.includes(hint))) {
    return 'seller';
  }

  // Check for customer role hints (titles, roles)
  if (CUSTOMER_ROLE_HINTS.some(hint => normalized.includes(hint))) {
    return 'customer';
  }

  // If we know the seller name and this speaker is different, assume customer
  if (sellerName && !normalized.includes(sellerName.toLowerCase())) {
    // This is a named speaker that's not the seller - likely a customer
    // Check if it looks like a name (starts with capital, not a timestamp, etc.)
    const firstWord = speaker.split(/[\s(]/)[0];
    if (firstWord && /^[A-Z][a-z]+$/.test(firstWord)) {
      return 'customer';
    }
  }

  return 'unknown';
};

const computeCoachingMetrics = (
  transcript: string,
  sellerName?: string
): CoachingMetrics => {
  const utterances = extractUtterances(transcript);
  const wordCounts = { seller: 0, customer: 0, unknown: 0 };
  let sellerQuestions = 0;
  let openQuestions = 0;

  utterances.forEach(({ speaker, text }) => {
    const role = detectSpeakerRole(speaker, sellerName);
    const words = text.split(/\s+/).filter(Boolean).length;
    wordCounts[role] += words;

    if (role === 'seller' && text.includes('?')) {
      sellerQuestions += 1;
      const lower = text.toLowerCase();
      if (OPEN_QUESTION_HINTS.some(hint => lower.includes(hint))) {
        openQuestions += 1;
      }
    }
  });

  const knownWords = wordCounts.seller + wordCounts.customer;
  const sellerPct = knownWords
    ? Math.round((wordCounts.seller / knownWords) * 100)
    : 50;
  const customerPct = 100 - sellerPct;
  const questionScore =
    sellerQuestions === 0
      ? 0
      : Math.round((openQuestions / sellerQuestions) * 100);

  const observations: string[] = [];
  if (knownWords === 0) {
    observations.push(
      'Speaker labels were not detected; talk ratio is estimated.'
    );
  } else if (sellerPct > 70) {
    observations.push('Seller talk ratio is high; aim for more buyer airtime.');
  }
  if (sellerQuestions === 0) {
    observations.push('No seller questions detected; add more discovery.');
  }

  return {
    talkRatio: {
      sellerPct,
      customerPct,
      sellerWords: wordCounts.seller,
      customerWords: wordCounts.customer,
    },
    questionScore: {
      sellerQuestions,
      openQuestions,
      score: questionScore,
    },
    observations,
  };
};

const normalizeIntent = (intent: SalesTranscriptAnalysisResponse['intent']) => {
  const total =
    intent.buyNow + intent.buySoon + intent.later + intent.noFit || 1;
  const scaled = {
    buyNow: Math.round((intent.buyNow / total) * 100),
    buySoon: Math.round((intent.buySoon / total) * 100),
    later: Math.round((intent.later / total) * 100),
    noFit: Math.round((intent.noFit / total) * 100),
  };
  const remainder =
    100 - (scaled.buyNow + scaled.buySoon + scaled.later + scaled.noFit);
  if (remainder !== 0) {
    scaled.buySoon = Math.max(0, scaled.buySoon + remainder);
  }
  const primary = (Object.entries(scaled) as Array<
    [keyof typeof scaled, number]
  >).sort((a, b) => b[1] - a[1])[0][0];

  return {
    ...scaled,
    primary:
      primary === 'buyNow'
        ? 'BuyNow'
        : primary === 'buySoon'
          ? 'BuySoon'
          : primary === 'later'
            ? 'Later'
            : 'NoFit',
  };
};

const safeJsonParse = (raw: string): any => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const buildPrompt = (
  request: SalesTranscriptAnalysisRequest,
  coaching: CoachingMetrics
) => {
  const participants = request.participants?.join(', ') || 'Unknown';
  return `
You are a sales meeting analyst. Return ONLY valid JSON, no markdown.

Meeting metadata:
- Account: ${request.accountName || 'Unknown'}
- Date: ${request.meetingDate || 'Unknown'}
- Seller: ${request.sellerName || 'Unknown'}
- Participants: ${participants}
- Notes: ${request.notes || 'None'}

Computed coaching metrics (do not change these numbers):
${JSON.stringify(coaching, null, 2)}

Return JSON with this exact shape:
{
  "summary": "string",
  "intent": {
    "buyNow": number,
    "buySoon": number,
    "later": number,
    "noFit": number,
    "primary": "BuyNow|BuySoon|Later|NoFit"
  },
  "signals": ["string", "..."],
  "blockers": ["string", "..."],
  "nextSteps": ["string", "..."],
  "followUp": {
    "timing": "string",
    "emailDraft": "string",
    "callScript": "string"
  },
  "coaching": {
    "talkRatio": {
      "sellerPct": ${coaching.talkRatio.sellerPct},
      "customerPct": ${coaching.talkRatio.customerPct},
      "sellerWords": ${coaching.talkRatio.sellerWords},
      "customerWords": ${coaching.talkRatio.customerWords}
    },
    "questionScore": {
      "sellerQuestions": ${coaching.questionScore.sellerQuestions},
      "openQuestions": ${coaching.questionScore.openQuestions},
      "score": ${coaching.questionScore.score}
    },
    "observations": ["string", "..."]
  },
  "competitors": [
    {
      "name": "competitor company name",
      "context": "brief description of why/how they were mentioned",
      "sentiment": "positive|negative|neutral",
      "quote": "exact quote from transcript mentioning competitor"
    }
  ],
  "competitorInsights": {
    "topThreat": "name of most threatening competitor or null if none",
    "positioning": ["counter-positioning suggestion 1", "suggestion 2"]
  }
}

Rules:
- intent values must sum to 100.
- keep arrays 3-5 items when possible.
- use plain text, no markdown.
- be concise and actionable.
- competitors: identify any competitor companies mentioned in the transcript (e.g., Salesforce, HubSpot, Gong, etc.)
- if no competitors mentioned, return empty array for competitors and null for competitorInsights
`;
};

export const analyzeTranscriptWithAI = async (
  request: SalesTranscriptAnalysisRequest
): Promise<Omit<SalesTranscriptAnalysisResponse, 'id' | 'createdAt'>> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const coaching = computeCoachingMetrics(request.transcript, request.sellerName);

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    max_completion_tokens: 2500,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert sales analyst who provides concise, actionable insights.',
      },
      { role: 'user', content: buildPrompt(request, coaching) },
      { role: 'user', content: `Transcript:\n${request.transcript}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';
  console.log('OpenAI raw response:', raw);
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON from OpenAI: ' + raw.slice(0, 200));
  }

  // Parse competitors
  const competitors: CompetitorMention[] = Array.isArray(parsed.competitors)
    ? parsed.competitors.map((c: any) => ({
        name: String(c.name || ''),
        context: String(c.context || ''),
        sentiment: ['positive', 'negative', 'neutral'].includes(c.sentiment)
          ? c.sentiment
          : 'neutral',
        quote: String(c.quote || ''),
      })).filter((c: CompetitorMention) => c.name.length > 0)
    : [];

  // Parse competitor insights
  const competitorInsights: CompetitorInsights | undefined =
    parsed.competitorInsights && typeof parsed.competitorInsights === 'object'
      ? {
          topThreat: parsed.competitorInsights.topThreat || undefined,
          positioning: Array.isArray(parsed.competitorInsights.positioning)
            ? parsed.competitorInsights.positioning.map(String)
            : [],
        }
      : undefined;

  return {
    meetingDate: request.meetingDate,
    accountName: request.accountName,
    participants: request.participants,
    sellerName: request.sellerName,
    notes: request.notes,
    summary: String(parsed.summary || ''),
    intent: normalizeIntent(parsed.intent || {}),
    signals: Array.isArray(parsed.signals) ? parsed.signals.map(String) : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers.map(String) : [],
    nextSteps: Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.map(String)
      : [],
    followUp: {
      timing: String(parsed.followUp?.timing || ''),
      emailDraft: String(parsed.followUp?.emailDraft || ''),
      callScript: String(parsed.followUp?.callScript || ''),
    },
    coaching: {
      ...coaching,
      observations:
        Array.isArray(parsed.coaching?.observations) &&
        parsed.coaching.observations.length
          ? parsed.coaching.observations.map(String)
          : coaching.observations,
    },
    competitors: competitors.length > 0 ? competitors : undefined,
    competitorInsights: competitorInsights,
  };
};

export const analyzeTranscriptFallback = (
  request: SalesTranscriptAnalysisRequest
): Omit<SalesTranscriptAnalysisResponse, 'id' | 'createdAt'> => {
  const coaching = computeCoachingMetrics(request.transcript, request.sellerName);

  // Basic competitor detection for fallback mode
  const competitorKeywords = [
    'salesforce', 'hubspot', 'gong', 'chorus', 'outreach', 'salesloft',
    'zoho', 'pipedrive', 'freshsales', 'close', 'copper', 'zendesk sell',
    'microsoft dynamics', 'oracle', 'sap', 'competitor', 'alternative'
  ];
  const transcriptLower = request.transcript.toLowerCase();
  const detectedCompetitors = competitorKeywords.filter(c => transcriptLower.includes(c));

  return {
    meetingDate: request.meetingDate,
    accountName: request.accountName,
    participants: request.participants,
    sellerName: request.sellerName,
    notes: request.notes,
    summary:
      'Transcript analyzed with a fallback model. Add an OpenAI key for richer insights.',
    intent: {
      buyNow: 25,
      buySoon: 35,
      later: 25,
      noFit: 15,
      primary: 'BuySoon',
    },
    signals: ['No strong intent cues detected from the transcript.'],
    blockers: ['Budget, timeline, and decision-maker clarity are unconfirmed.'],
    nextSteps: [
      'Confirm the decision timeline and stakeholders.',
      'Share a tailored recap and proposed next meeting.',
      'Align on success criteria for the buyer.',
    ],
    followUp: {
      timing: 'Within 48 hours',
      emailDraft:
        'Thanks again for the conversation. I wanted to recap key goals and confirm timeline and stakeholders before our next step.',
      callScript:
        'I wanted to confirm the decision timeline and who needs to be involved so we can move forward.',
    },
    coaching,
    competitors: detectedCompetitors.length > 0
      ? detectedCompetitors.map(name => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          context: 'Mentioned in transcript (fallback detection)',
          sentiment: 'neutral' as const,
          quote: 'Enable AI for exact quotes',
        }))
      : undefined,
    competitorInsights: detectedCompetitors.length > 0
      ? {
          topThreat: detectedCompetitors[0].charAt(0).toUpperCase() + detectedCompetitors[0].slice(1),
          positioning: ['Add OpenAI key for detailed counter-positioning suggestions'],
        }
      : undefined,
  };
};

export const improveContent = async (
  content: string,
  type: 'email' | 'callScript'
): Promise<string> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = type === 'email'
    ? `You are an expert sales copywriter. Improve the following sales follow-up email to be more:
- Professional and personalized
- Clear and concise
- Action-oriented with specific next steps
- Properly formatted with clear paragraphs
- Free of spelling and grammar errors

Keep the same general message and intent, but make it more compelling and polished.
Return ONLY the improved email text, no explanations.`
    : `You are an expert sales coach. Improve the following call script to be more:
- Conversational and natural
- Well-structured with clear sections
- Question-focused to drive discovery
- Easy to follow with numbered steps
- Free of spelling and grammar errors

Keep the same general approach, but make it more effective and easier to use.
Return ONLY the improved script text, no explanations.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    max_completion_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content },
    ],
  });

  return completion.choices[0]?.message?.content || content;
};

export interface CoachingAdvice {
  observation: string;
  whyItMatters: string;
  actionableTips: string[];
  examplePhrases: string[];
  relatedMetrics: string[];
}

export const getCoachingAdvice = async (
  observation: string,
  sellerName?: string,
  metrics?: {
    talkRatio?: number;
    questionScore?: number;
    avgBuyLikelihood?: number;
  }
): Promise<CoachingAdvice> => {
  if (!process.env.OPENAI_API_KEY) {
    // Return fallback advice
    return {
      observation,
      whyItMatters: 'This observation highlights an area for improvement in your sales conversations.',
      actionableTips: [
        'Review your recent calls and identify specific moments where this occurred.',
        'Practice with a colleague or manager to develop new habits.',
        'Set a specific goal for your next call related to this area.',
      ],
      examplePhrases: [
        '"That\'s a great point. Can you tell me more about...?"',
        '"I want to make sure I understand your needs. What would success look like for you?"',
        '"Before I continue, what questions do you have so far?"',
      ],
      relatedMetrics: ['Talk ratio', 'Question quality', 'Discovery depth'],
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const contextInfo = [];
  if (sellerName) contextInfo.push(`Salesperson: ${sellerName}`);
  if (metrics?.talkRatio) contextInfo.push(`Current talk ratio: ${metrics.talkRatio}% seller`);
  if (metrics?.questionScore) contextInfo.push(`Question quality score: ${metrics.questionScore}%`);
  if (metrics?.avgBuyLikelihood) contextInfo.push(`Average buy likelihood: ${metrics.avgBuyLikelihood}%`);

  const systemPrompt = `You are an expert B2B sales coach with 20+ years of experience training top-performing sales teams.
Your role is to provide actionable, specific coaching advice based on observed behaviors in sales calls.

${contextInfo.length > 0 ? `Context:\n${contextInfo.join('\n')}` : ''}

Based on the observation provided, give coaching advice in the following JSON format:
{
  "whyItMatters": "A 2-3 sentence explanation of why this behavior impacts sales outcomes, with specific data or research if relevant",
  "actionableTips": ["3-4 specific, practical tips the salesperson can implement immediately"],
  "examplePhrases": ["3-4 word-for-word phrases or questions they can use in their next call"],
  "relatedMetrics": ["2-3 metrics they should track to measure improvement"]
}

Be specific, practical, and encouraging. Focus on improvement, not criticism.
Return ONLY valid JSON, no additional text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      max_completion_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Coaching observation: "${observation}"` },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText);

    return {
      observation,
      whyItMatters: parsed.whyItMatters || 'This observation highlights an area for improvement.',
      actionableTips: parsed.actionableTips || ['Practice this skill in your next call.'],
      examplePhrases: parsed.examplePhrases || ['"Can you tell me more about that?"'],
      relatedMetrics: parsed.relatedMetrics || ['Talk ratio', 'Question quality'],
    };
  } catch (error) {
    console.error('Failed to get coaching advice:', error);
    return {
      observation,
      whyItMatters: 'This observation highlights an area for improvement in your sales conversations.',
      actionableTips: [
        'Review your recent calls and identify specific moments where this occurred.',
        'Practice with a colleague or manager to develop new habits.',
        'Set a specific goal for your next call related to this area.',
      ],
      examplePhrases: [
        '"That\'s a great point. Can you tell me more about...?"',
        '"I want to make sure I understand your needs. What would success look like for you?"',
      ],
      relatedMetrics: ['Talk ratio', 'Question quality', 'Discovery depth'],
    };
  }
};
