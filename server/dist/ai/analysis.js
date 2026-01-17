"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.improveContent = exports.analyzeTranscriptFallback = exports.analyzeTranscriptWithAI = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
const SELLER_HINTS = ['sales', 'rep', 'agent', 'host', 'presenter'];
const CUSTOMER_HINTS = ['customer', 'client', 'prospect', 'buyer'];
const extractUtterances = (transcript) => {
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
const detectSpeakerRole = (speaker, sellerName) => {
    const normalized = speaker.trim().toLowerCase();
    if (sellerName && normalized.includes(sellerName.toLowerCase())) {
        return 'seller';
    }
    if (SELLER_HINTS.some(hint => normalized.includes(hint))) {
        return 'seller';
    }
    if (CUSTOMER_HINTS.some(hint => normalized.includes(hint))) {
        return 'customer';
    }
    return 'unknown';
};
const computeCoachingMetrics = (transcript, sellerName) => {
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
    const questionScore = sellerQuestions === 0
        ? 0
        : Math.round((openQuestions / sellerQuestions) * 100);
    const observations = [];
    if (knownWords === 0) {
        observations.push('Speaker labels were not detected; talk ratio is estimated.');
    }
    else if (sellerPct > 70) {
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
const normalizeIntent = (intent) => {
    const total = intent.buyNow + intent.buySoon + intent.later + intent.noFit || 1;
    const scaled = {
        buyNow: Math.round((intent.buyNow / total) * 100),
        buySoon: Math.round((intent.buySoon / total) * 100),
        later: Math.round((intent.later / total) * 100),
        noFit: Math.round((intent.noFit / total) * 100),
    };
    const remainder = 100 - (scaled.buyNow + scaled.buySoon + scaled.later + scaled.noFit);
    if (remainder !== 0) {
        scaled.buySoon = Math.max(0, scaled.buySoon + remainder);
    }
    const primary = Object.entries(scaled).sort((a, b) => b[1] - a[1])[0][0];
    return {
        ...scaled,
        primary: primary === 'buyNow'
            ? 'BuyNow'
            : primary === 'buySoon'
                ? 'BuySoon'
                : primary === 'later'
                    ? 'Later'
                    : 'NoFit',
    };
};
const safeJsonParse = (raw) => {
    try {
        return JSON.parse(raw);
    }
    catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(raw.slice(start, end + 1));
            }
            catch {
                return null;
            }
        }
        return null;
    }
};
const buildPrompt = (request, coaching) => {
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
  }
}

Rules:
- intent values must sum to 100.
- keep arrays 3-5 items when possible.
- use plain text, no markdown.
- be concise and actionable.
`;
};
const analyzeTranscriptWithAI = async (request) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set');
    }
    const openai = new openai_1.default({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const coaching = computeCoachingMetrics(request.transcript, request.sellerName);
    const completion = await openai.chat.completions.create({
        model: 'gpt-5.2',
        max_completion_tokens: 2500,
        messages: [
            {
                role: 'system',
                content: 'You are an expert sales analyst who provides concise, actionable insights.',
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
            observations: Array.isArray(parsed.coaching?.observations) &&
                parsed.coaching.observations.length
                ? parsed.coaching.observations.map(String)
                : coaching.observations,
        },
    };
};
exports.analyzeTranscriptWithAI = analyzeTranscriptWithAI;
const analyzeTranscriptFallback = (request) => {
    const coaching = computeCoachingMetrics(request.transcript, request.sellerName);
    return {
        meetingDate: request.meetingDate,
        accountName: request.accountName,
        participants: request.participants,
        sellerName: request.sellerName,
        notes: request.notes,
        summary: 'Transcript analyzed with a fallback model. Add an OpenAI key for richer insights.',
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
            emailDraft: 'Thanks again for the conversation. I wanted to recap key goals and confirm timeline and stakeholders before our next step.',
            callScript: 'I wanted to confirm the decision timeline and who needs to be involved so we can move forward.',
        },
        coaching,
    };
};
exports.analyzeTranscriptFallback = analyzeTranscriptFallback;
const improveContent = async (content, type) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set');
    }
    const openai = new openai_1.default({
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
exports.improveContent = improveContent;
