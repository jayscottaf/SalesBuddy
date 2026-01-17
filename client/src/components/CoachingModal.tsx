import { useState, useEffect } from 'react';
import './CoachingModal.css';

interface CoachingAdvice {
  observation: string;
  whyItMatters: string;
  actionableTips: string[];
  examplePhrases: string[];
  relatedMetrics: string[];
}

interface CoachingModalProps {
  observation: string;
  sellerName?: string;
  metrics?: {
    talkRatio?: number;
    questionScore?: number;
    avgBuyLikelihood?: number;
  };
  onClose: () => void;
}

export default function CoachingModal({
  observation,
  sellerName,
  metrics,
  onClose,
}: CoachingModalProps) {
  const [advice, setAdvice] = useState<CoachingAdvice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdvice = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/sales/coaching', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observation, sellerName, metrics }),
        });

        if (!response.ok) {
          throw new Error('Failed to get coaching advice');
        }

        const data = await response.json();
        setAdvice(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdvice();
  }, [observation, sellerName, metrics]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="coaching-modal-backdrop" onClick={handleBackdropClick}>
      <div className="coaching-modal">
        <div className="coaching-modal-header">
          <div className="coaching-modal-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="coaching-modal-title">
            <h2>Coaching Insight</h2>
            <p>AI-powered advice to improve your sales skills</p>
          </div>
          <button className="coaching-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="coaching-modal-observation">
          <span className="observation-label">Observation</span>
          <p>{observation}</p>
        </div>

        {isLoading && (
          <div className="coaching-modal-loading">
            <div className="loading-spinner" />
            <p>Generating personalized coaching advice...</p>
          </div>
        )}

        {error && (
          <div className="coaching-modal-error">
            <p>{error}</p>
            <button onClick={onClose}>Close</button>
          </div>
        )}

        {advice && !isLoading && (
          <div className="coaching-modal-content">
            <div className="coaching-section">
              <div className="coaching-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <h3>Why This Matters</h3>
              </div>
              <p className="coaching-text">{advice.whyItMatters}</p>
            </div>

            <div className="coaching-section">
              <div className="coaching-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h3>Action Steps</h3>
              </div>
              <ul className="coaching-tips">
                {advice.actionableTips.map((tip, idx) => (
                  <li key={idx}>
                    <span className="tip-number">{idx + 1}</span>
                    <span className="tip-text">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="coaching-section">
              <div className="coaching-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h3>Try These Phrases</h3>
              </div>
              <div className="coaching-phrases">
                {advice.examplePhrases.map((phrase, idx) => (
                  <div key={idx} className="phrase-card">
                    <span className="phrase-quote">"</span>
                    <p>{phrase.replace(/^["']|["']$/g, '')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="coaching-section coaching-metrics-section">
              <div className="coaching-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <h3>Track Your Progress</h3>
              </div>
              <div className="coaching-metrics-tags">
                {advice.relatedMetrics.map((metric, idx) => (
                  <span key={idx} className="metric-tag">{metric}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="coaching-modal-footer">
          <button className="coaching-close-btn" onClick={onClose}>
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
