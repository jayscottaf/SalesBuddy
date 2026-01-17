import { useMemo } from 'react';
import type { SalesTranscriptAnalysisResponse } from '@shared/schema';
import './AccountAnalysis.css';

interface AccountAnalysisProps {
  accountName: string;
  meetings: SalesTranscriptAnalysisResponse[];
  onSelectMeeting: (id: string) => void;
}

export default function AccountAnalysis({ accountName, meetings, onSelectMeeting }: AccountAnalysisProps) {
  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const dateA = a.meetingDate ? new Date(a.meetingDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.meetingDate ? new Date(b.meetingDate).getTime() : new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [meetings]);

  const dealProgression = useMemo(() => {
    return sortedMeetings.map((m, i) => ({
      date: m.meetingDate || new Date(m.createdAt).toLocaleDateString(),
      intent: m.intent,
      index: i + 1,
    }));
  }, [sortedMeetings]);

  const latestMeeting = sortedMeetings[sortedMeetings.length - 1];
  const firstMeeting = sortedMeetings[0];

  const intentTrend = useMemo(() => {
    if (sortedMeetings.length < 2) return 'neutral';
    const firstBuyIntent = firstMeeting.intent.buyNow + firstMeeting.intent.buySoon;
    const latestBuyIntent = latestMeeting.intent.buyNow + latestMeeting.intent.buySoon;
    if (latestBuyIntent > firstBuyIntent + 10) return 'improving';
    if (latestBuyIntent < firstBuyIntent - 10) return 'declining';
    return 'stable';
  }, [sortedMeetings, firstMeeting, latestMeeting]);

  const allBlockers = useMemo(() => {
    const blockerMap = new Map<string, { count: number; resolved: boolean }>();
    sortedMeetings.forEach((m, idx) => {
      m.blockers.forEach(b => {
        const key = b.toLowerCase().slice(0, 50);
        if (!blockerMap.has(key)) {
          blockerMap.set(key, { count: 1, resolved: idx < sortedMeetings.length - 1 });
        } else {
          const existing = blockerMap.get(key)!;
          existing.count++;
          if (idx === sortedMeetings.length - 1) {
            existing.resolved = false;
          }
        }
      });
    });
    return blockerMap;
  }, [sortedMeetings]);

  const avgTalkRatio = useMemo(() => {
    const total = meetings.reduce((sum, m) => sum + m.coaching.talkRatio.sellerPct, 0);
    return Math.round(total / meetings.length);
  }, [meetings]);

  const avgQuestionScore = useMemo(() => {
    const total = meetings.reduce((sum, m) => sum + m.coaching.questionScore.score, 0);
    return Math.round(total / meetings.length);
  }, [meetings]);

  // Aggregate competitor data across all meetings
  const competitorStats = useMemo(() => {
    const compMap = new Map<string, {
      count: number;
      sentiments: ('positive' | 'negative' | 'neutral')[];
      latestContext: string;
    }>();

    sortedMeetings.forEach(m => {
      m.competitors?.forEach(comp => {
        const key = comp.name.toLowerCase();
        const existing = compMap.get(key);
        if (existing) {
          existing.count++;
          existing.sentiments.push(comp.sentiment);
          existing.latestContext = comp.context;
        } else {
          compMap.set(key, {
            count: 1,
            sentiments: [comp.sentiment],
            latestContext: comp.context,
          });
        }
      });
    });

    return Array.from(compMap.entries())
      .map(([name, data]) => {
        // Calculate dominant sentiment
        const sentimentCounts = data.sentiments.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const dominantSentiment = Object.entries(sentimentCounts)
          .sort((a, b) => b[1] - a[1])[0][0] as 'positive' | 'negative' | 'neutral';

        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          sentiment: dominantSentiment,
          context: data.latestContext,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [sortedMeetings]);

  return (
    <div className="account-analysis">
      <div className="account-header">
        <h2>{accountName}</h2>
        <div className="account-stats">
          <span className="stat">
            <strong>{meetings.length}</strong> meetings
          </span>
          <span className={`stat trend trend--${intentTrend}`}>
            {intentTrend === 'improving' && '↑ Improving'}
            {intentTrend === 'declining' && '↓ Declining'}
            {intentTrend === 'stable' && '→ Stable'}
            {intentTrend === 'neutral' && '• New'}
          </span>
        </div>
      </div>

      <div className="account-section">
        <h3>Deal Progression</h3>
        <div className="progression-timeline">
          {dealProgression.map((p, i) => (
            <div key={i} className="progression-item" onClick={() => onSelectMeeting(sortedMeetings[i].id)}>
              <div className="progression-marker">
                <div className={`progression-dot intent--${p.intent.primary.toLowerCase()}`} />
                {i < dealProgression.length - 1 && <div className="progression-line" />}
              </div>
              <div className="progression-content">
                <div className="progression-date">Meeting {p.index} • {p.date}</div>
                <div className="progression-intent">
                  <span className={`intent-badge intent--${p.intent.primary.toLowerCase()}`}>
                    {p.intent.primary}
                  </span>
                  <span className="intent-detail">
                    Buy: {p.intent.buyNow + p.intent.buySoon}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="account-grid">
        <div className="account-section">
          <h3>Current Status</h3>
          <div className="status-card">
            <div className="status-row">
              <span>Primary Intent</span>
              <span className={`intent-badge intent--${latestMeeting.intent.primary.toLowerCase()}`}>
                {latestMeeting.intent.primary}
              </span>
            </div>
            <div className="status-row">
              <span>Buy Likelihood</span>
              <span>{latestMeeting.intent.buyNow + latestMeeting.intent.buySoon}%</span>
            </div>
            <div className="status-row">
              <span>Trend</span>
              <span className={`trend trend--${intentTrend}`}>
                {intentTrend.charAt(0).toUpperCase() + intentTrend.slice(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="account-section">
          <h3>Engagement Quality</h3>
          <div className="status-card">
            <div className="status-row">
              <span>Avg Talk Ratio</span>
              <span className={avgTalkRatio > 60 ? 'warning' : ''}>{avgTalkRatio}% seller</span>
            </div>
            <div className="status-row">
              <span>Avg Question Score</span>
              <span className={avgQuestionScore < 50 ? 'warning' : ''}>{avgQuestionScore}%</span>
            </div>
            <div className="status-row">
              <span>Meetings</span>
              <span>{meetings.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="account-section">
        <h3>Blockers Tracking</h3>
        <div className="blockers-list">
          {Array.from(allBlockers.entries()).map(([blocker, data]) => (
            <div key={blocker} className={`blocker-item ${data.resolved ? 'resolved' : 'active'}`}>
              <span className="blocker-status">
                {data.resolved ? '✓' : '•'}
              </span>
              <span className="blocker-text">{blocker}</span>
              {data.count > 1 && (
                <span className="blocker-count">Mentioned {data.count}x</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {competitorStats.length > 0 && (
        <div className="account-section">
          <h3>Competitive Landscape</h3>
          <div className="competitors-tracking">
            {competitorStats.map(comp => (
              <div key={comp.name} className={`competitor-track-item sentiment-${comp.sentiment}`}>
                <div className="competitor-track-header">
                  <span className="competitor-track-name">{comp.name}</span>
                  <div className="competitor-track-meta">
                    <span className={`competitor-track-sentiment sentiment-${comp.sentiment}`}>
                      {comp.sentiment}
                    </span>
                    <span className="competitor-track-count">{comp.count}x</span>
                  </div>
                </div>
                <p className="competitor-track-context">{comp.context}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="account-section">
        <h3>Latest Summary</h3>
        <p className="summary-text">{latestMeeting.summary}</p>
      </div>

      <div className="account-section">
        <h3>Meeting History</h3>
        <div className="meeting-list">
          {sortedMeetings.map((m, i) => (
            <div
              key={m.id}
              className="meeting-item"
              onClick={() => onSelectMeeting(m.id)}
            >
              <div className="meeting-number">#{i + 1}</div>
              <div className="meeting-info">
                <div className="meeting-date">{m.meetingDate || 'No date'}</div>
                <div className="meeting-summary">{m.summary.slice(0, 100)}...</div>
              </div>
              <span className={`intent-badge intent--${m.intent.primary.toLowerCase()}`}>
                {m.intent.primary}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
