import { useState, useEffect } from 'react';
import './AdminFeedback.css';

interface FeedbackItem {
  id: string;
  createdAt: string;
  type: string;
  message: string;
  email?: string;
  userId?: string;
  page?: string;
  userAgent?: string;
}

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feedback');
      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }
      const data = await response.json();
      setFeedback(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedback = filter === 'all'
    ? feedback
    : feedback.filter(f => f.type === filter);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return 'Bug Report';
      case 'feature': return 'Feature Request';
      case 'general': return 'General';
      default: return type;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'bug': return 'badge-bug';
      case 'feature': return 'badge-feature';
      case 'general': return 'badge-general';
      default: return '';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="admin-feedback">
        <div className="admin-loading">Loading feedback...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-feedback">
        <div className="admin-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="admin-feedback">
      <div className="admin-header">
        <h2>User Feedback</h2>
        <div className="admin-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({feedback.length})
          </button>
          <button
            className={`filter-btn ${filter === 'bug' ? 'active' : ''}`}
            onClick={() => setFilter('bug')}
          >
            Bugs ({feedback.filter(f => f.type === 'bug').length})
          </button>
          <button
            className={`filter-btn ${filter === 'feature' ? 'active' : ''}`}
            onClick={() => setFilter('feature')}
          >
            Features ({feedback.filter(f => f.type === 'feature').length})
          </button>
          <button
            className={`filter-btn ${filter === 'general' ? 'active' : ''}`}
            onClick={() => setFilter('general')}
          >
            General ({feedback.filter(f => f.type === 'general').length})
          </button>
        </div>
      </div>

      {filteredFeedback.length === 0 ? (
        <div className="admin-empty">
          <p>No feedback yet.</p>
        </div>
      ) : (
        <div className="feedback-list">
          {filteredFeedback.map((item) => (
            <div key={item.id} className="feedback-item">
              <div className="feedback-item-header">
                <span className={`feedback-type-badge ${getTypeBadgeClass(item.type)}`}>
                  {getTypeLabel(item.type)}
                </span>
                <span className="feedback-date">{formatDate(item.createdAt)}</span>
              </div>
              <p className="feedback-message">{item.message}</p>
              <div className="feedback-meta">
                {item.email && (
                  <span className="meta-item">
                    <strong>Email:</strong> {item.email}
                  </span>
                )}
                {item.page && (
                  <span className="meta-item">
                    <strong>Page:</strong> {item.page}
                  </span>
                )}
                {item.userId && (
                  <span className="meta-item">
                    <strong>User ID:</strong> {item.userId.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
