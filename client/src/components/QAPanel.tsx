import { useEffect, useRef, useState } from 'react';
import './QAPanel.css';

interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface QAPanelProps {
  analysisId: string;
  persisted: boolean; // true when analysis has been saved server-side (not just local)
}

const SUGGESTIONS = [
  'What did they say about pricing?',
  'Why did they hesitate?',
  'Who is the decision-maker?',
  'What is the main blocker?',
  'What should my next email say?',
];

export default function QAPanel({ analysisId, persisted }: QAPanelProps) {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTranscript, setHasTranscript] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    if (!persisted) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/sales/analysis/${encodeURIComponent(analysisId)}/qa`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setHasTranscript(!!data.hasTranscript);
      } catch (err) {
        console.error('qa load failed', err);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [analysisId, persisted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    const userMsg: QAMessage = { id: 'tmp-' + Date.now(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    try {
      const res = await fetch(`/api/sales/analysis/${encodeURIComponent(analysisId)}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to get an answer.');
      }
      const data = await res.json();
      setMessages(prev => [...prev, { id: data.id || 'tmp-a-' + Date.now(), role: 'assistant', content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get an answer.');
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  if (!persisted) {
    return (
      <div className="qa-panel">
        <div className="qa-panel__header">
          <h4>Ask about this meeting</h4>
        </div>
        <p className="qa-panel__unavailable">Save the analysis first to enable follow-up questions.</p>
      </div>
    );
  }

  return (
    <div className="qa-panel">
      <div className="qa-panel__header">
        <h4>Ask about this meeting</h4>
        {!hasTranscript && (
          <span className="qa-panel__badge" title="Transcript wasn't stored for this analysis — answers use the structured summary only.">
            Summary-only mode
          </span>
        )}
      </div>
      <div className="qa-panel__messages" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="qa-panel__empty">
            <p>Ask anything about this call — budget, timeline, objections, next steps.</p>
            <div className="qa-panel__suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" className="qa-panel__chip" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`qa-msg qa-msg--${m.role}`}>
            <div className="qa-msg__bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="qa-msg qa-msg--assistant">
            <div className="qa-msg__bubble qa-msg__bubble--thinking">
              <span className="qa-dot"></span><span className="qa-dot"></span><span className="qa-dot"></span>
            </div>
          </div>
        )}
      </div>
      {error && <div className="qa-panel__error">{error}</div>}
      <form
        className="qa-panel__form"
        onSubmit={e => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          type="text"
          placeholder="Ask a question about this meeting..."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? '…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
