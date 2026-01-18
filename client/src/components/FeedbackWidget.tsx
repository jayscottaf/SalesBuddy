import { useState } from 'react';
import './FeedbackWidget.css';

type FeedbackType = 'general' | 'bug' | 'feature';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          email: email.trim() || undefined,
          page: window.location.pathname,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit feedback');
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setMessage('');
        setEmail('');
        setType('general');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        className="feedback-trigger"
        onClick={() => setIsOpen(true)}
        title="Send feedback"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>Feedback</span>
      </button>

      {isOpen && (
        <div className="feedback-overlay" onClick={handleClose}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-header">
              <h3>Send Feedback</h3>
              <button className="feedback-close" onClick={handleClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {submitted ? (
              <div className="feedback-success">
                <div className="feedback-success-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h4>Thank you!</h4>
                <p>Your feedback helps us improve Salesbuddy.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="feedback-field">
                  <label>What type of feedback?</label>
                  <div className="feedback-types">
                    <button
                      type="button"
                      className={`feedback-type-btn ${type === 'general' ? 'active' : ''}`}
                      onClick={() => setType('general')}
                    >
                      General
                    </button>
                    <button
                      type="button"
                      className={`feedback-type-btn ${type === 'bug' ? 'active' : ''}`}
                      onClick={() => setType('bug')}
                    >
                      Bug Report
                    </button>
                    <button
                      type="button"
                      className={`feedback-type-btn ${type === 'feature' ? 'active' : ''}`}
                      onClick={() => setType('feature')}
                    >
                      Feature Request
                    </button>
                  </div>
                </div>

                <div className="feedback-field">
                  <label htmlFor="feedback-message">
                    {type === 'bug' ? "What's the issue?" : type === 'feature' ? "What would you like to see?" : "What's on your mind?"}
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === 'bug'
                        ? "Describe what happened and what you expected..."
                        : type === 'feature'
                        ? "Describe the feature you'd like..."
                        : "Share your thoughts, suggestions, or questions..."
                    }
                    rows={4}
                    required
                  />
                </div>

                <div className="feedback-field">
                  <label htmlFor="feedback-email">Email (optional)</label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                  <span className="feedback-hint">We'll only use this to follow up if needed</span>
                </div>

                {error && (
                  <div className="feedback-error">{error}</div>
                )}

                <div className="feedback-actions">
                  <button
                    type="button"
                    className="feedback-cancel"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="feedback-submit"
                    disabled={isSubmitting || !message.trim()}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
