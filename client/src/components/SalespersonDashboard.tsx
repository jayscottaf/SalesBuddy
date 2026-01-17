import { useMemo, useState } from 'react';
import type { SalesTranscriptAnalysisResponse } from '@shared/schema';
import CoachingModal from './CoachingModal';
import './SalespersonDashboard.css';

interface SalespersonDashboardProps {
  sellerName: string;
  meetings: SalesTranscriptAnalysisResponse[];
  onSelectMeeting: (id: string) => void;
}

interface PerformanceMetric {
  label: string;
  value: number;
  target: number;
  unit: string;
  description: string;
  isGood: boolean;
}

export default function SalespersonDashboard({ sellerName, meetings, onSelectMeeting }: SalespersonDashboardProps) {
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const dateA = a.meetingDate ? new Date(a.meetingDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.meetingDate ? new Date(b.meetingDate).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [meetings]);

  // Calculate performance metrics
  const metrics = useMemo((): PerformanceMetric[] => {
    if (meetings.length === 0) return [];

    // Talk ratio - ideal is 40-60% seller talk time
    const avgTalkRatio = Math.round(
      meetings.reduce((sum, m) => sum + m.coaching.talkRatio.sellerPct, 0) / meetings.length
    );
    const talkRatioGood = avgTalkRatio >= 35 && avgTalkRatio <= 55;

    // Question score - higher is better, measures open vs closed questions
    const avgQuestionScore = Math.round(
      meetings.reduce((sum, m) => sum + m.coaching.questionScore.score, 0) / meetings.length
    );
    const questionScoreGood = avgQuestionScore >= 50;

    // Close rate - % of meetings with BuyNow as primary intent (ready to close)
    const closeReadyMeetings = meetings.filter(
      m => m.intent.primary === 'BuyNow'
    );
    const closeRate = Math.round((closeReadyMeetings.length / meetings.length) * 100);
    const closeRateGood = closeRate >= 20;

    // Average buy likelihood
    const avgBuyLikelihood = Math.round(
      meetings.reduce((sum, m) => sum + m.intent.buyNow + m.intent.buySoon, 0) / meetings.length
    );
    const buyLikelihoodGood = avgBuyLikelihood >= 50;

    // Discovery depth - average signals identified per meeting
    const avgSignals = Math.round(
      meetings.reduce((sum, m) => sum + m.signals.length, 0) / meetings.length * 10
    ) / 10;
    const signalsGood = avgSignals >= 3;

    // Blocker identification - average blockers identified
    const avgBlockers = Math.round(
      meetings.reduce((sum, m) => sum + m.blockers.length, 0) / meetings.length * 10
    ) / 10;
    const blockersGood = avgBlockers >= 2 && avgBlockers <= 5;

    return [
      {
        label: 'Talk Ratio',
        value: avgTalkRatio,
        target: 45,
        unit: '%',
        description: 'Seller talk time (ideal: 40-55%)',
        isGood: talkRatioGood,
      },
      {
        label: 'Question Quality',
        value: avgQuestionScore,
        target: 60,
        unit: '%',
        description: 'Open-ended questions ratio',
        isGood: questionScoreGood,
      },
      {
        label: 'Close Ready',
        value: closeRate,
        target: 25,
        unit: '%',
        description: 'Meetings at BuyNow stage',
        isGood: closeRateGood,
      },
      {
        label: 'Avg Buy Likelihood',
        value: avgBuyLikelihood,
        target: 55,
        unit: '%',
        description: 'Combined buy intent score',
        isGood: buyLikelihoodGood,
      },
      {
        label: 'Discovery Depth',
        value: avgSignals,
        target: 4,
        unit: '',
        description: 'Avg signals uncovered',
        isGood: signalsGood,
      },
      {
        label: 'Blocker ID',
        value: avgBlockers,
        target: 3,
        unit: '',
        description: 'Avg blockers identified',
        isGood: blockersGood,
      },
    ];
  }, [meetings]);

  // Calculate overall performance score (0-100)
  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    const goodCount = metrics.filter(m => m.isGood).length;
    return Math.round((goodCount / metrics.length) * 100);
  }, [metrics]);

  const scoreLabel = useMemo(() => {
    if (overallScore >= 80) return { text: 'Excellent', class: 'excellent' };
    if (overallScore >= 60) return { text: 'Good', class: 'good' };
    if (overallScore >= 40) return { text: 'Developing', class: 'developing' };
    return { text: 'Needs Work', class: 'needs-work' };
  }, [overallScore]);

  // Get all coaching observations
  const allObservations = useMemo(() => {
    const obsMap = new Map<string, { text: string; count: number }>();
    meetings.forEach(m => {
      m.coaching.observations.forEach(obs => {
        // Use first 60 chars as key for deduplication, but store full text
        const key = obs.toLowerCase().slice(0, 60);
        const existing = obsMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          obsMap.set(key, { text: obs, count: 1 });
        }
      });
    });
    return Array.from(obsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [meetings]);

  // Account breakdown
  const accountBreakdown = useMemo(() => {
    const accounts = new Map<string, { count: number; avgBuyIntent: number; lastMeeting: string }>();
    meetings.forEach(m => {
      const name = m.accountName || 'Unknown';
      const existing = accounts.get(name);
      const buyIntent = m.intent.buyNow + m.intent.buySoon;
      if (existing) {
        existing.count++;
        existing.avgBuyIntent = Math.round((existing.avgBuyIntent * (existing.count - 1) + buyIntent) / existing.count);
        if (m.meetingDate && m.meetingDate > existing.lastMeeting) {
          existing.lastMeeting = m.meetingDate;
        }
      } else {
        accounts.set(name, {
          count: 1,
          avgBuyIntent: buyIntent,
          lastMeeting: m.meetingDate || new Date(m.createdAt).toISOString().split('T')[0],
        });
      }
    });
    return Array.from(accounts.entries())
      .sort((a, b) => b[1].avgBuyIntent - a[1].avgBuyIntent);
  }, [meetings]);

  // Trend over time (last 5 meetings)
  const recentTrend = useMemo(() => {
    const recent = sortedMeetings.slice(0, 5).reverse();
    return recent.map(m => ({
      date: m.meetingDate || new Date(m.createdAt).toLocaleDateString(),
      buyIntent: m.intent.buyNow + m.intent.buySoon,
      questionScore: m.coaching.questionScore.score,
      talkRatio: m.coaching.talkRatio.sellerPct,
    }));
  }, [sortedMeetings]);

  // Competitor statistics across all meetings
  const competitorStats = useMemo(() => {
    const compMap = new Map<string, {
      count: number;
      sentiments: ('positive' | 'negative' | 'neutral')[];
      accounts: Set<string>;
    }>();

    meetings.forEach(m => {
      m.competitors?.forEach(comp => {
        const key = comp.name.toLowerCase();
        const existing = compMap.get(key);
        if (existing) {
          existing.count++;
          existing.sentiments.push(comp.sentiment);
          if (m.accountName) existing.accounts.add(m.accountName);
        } else {
          const accounts = new Set<string>();
          if (m.accountName) accounts.add(m.accountName);
          compMap.set(key, {
            count: 1,
            sentiments: [comp.sentiment],
            accounts,
          });
        }
      });
    });

    return Array.from(compMap.entries())
      .map(([name, data]) => {
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
          accountCount: data.accounts.size,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [meetings]);

  if (meetings.length === 0) {
    return (
      <div className="salesperson-dashboard">
        <div className="dashboard-header">
          <h2>{sellerName}'s Performance</h2>
        </div>
        <div className="dashboard-empty">
          <p>No meetings recorded yet for {sellerName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="salesperson-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-main">
          <h2>{sellerName}'s Performance</h2>
          <span className="meeting-count">{meetings.length} meetings analyzed</span>
        </div>
        <div className={`overall-score score--${scoreLabel.class}`}>
          <div className="score-value">{overallScore}</div>
          <div className="score-label">{scoreLabel.text}</div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Key Metrics</h3>
        <div className="metrics-grid">
          {metrics.map(metric => (
            <div key={metric.label} className={`metric-card ${metric.isGood ? 'good' : 'needs-improvement'}`}>
              <div className="metric-header">
                <span className="metric-label">{metric.label}</span>
                <span className={`metric-indicator ${metric.isGood ? 'good' : 'warning'}`}>
                  {metric.isGood ? '✓' : '!'}
                </span>
              </div>
              <div className="metric-value">
                {metric.value}{metric.unit}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{ width: `${Math.min((metric.value / (metric.target * 1.5)) * 100, 100)}%` }}
                />
                <div
                  className="metric-bar-target"
                  style={{ left: `${(metric.target / (metric.target * 1.5)) * 100}%` }}
                />
              </div>
              <div className="metric-description">{metric.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <h3>Performance Trend</h3>
          <div className="trend-chart">
            {recentTrend.map((t, i) => (
              <div key={i} className="trend-item">
                <div className="trend-bars">
                  <div
                    className="trend-bar buy-intent"
                    style={{ height: `${t.buyIntent}%` }}
                    title={`Buy Intent: ${t.buyIntent}%`}
                  />
                  <div
                    className="trend-bar question-score"
                    style={{ height: `${t.questionScore}%` }}
                    title={`Question Score: ${t.questionScore}%`}
                  />
                </div>
                <div className="trend-date">{t.date.split('-').slice(1).join('/')}</div>
              </div>
            ))}
          </div>
          <div className="trend-legend">
            <span className="legend-item buy-intent">Buy Intent</span>
            <span className="legend-item question-score">Question Quality</span>
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Account Portfolio</h3>
          <div className="portfolio-legend">
            <span className="portfolio-legend-item cold">0-39% Cold</span>
            <span className="portfolio-legend-item warm">40-69% Warm</span>
            <span className="portfolio-legend-item hot">70%+ Hot</span>
          </div>
          <div className="account-portfolio">
            {accountBreakdown.slice(0, 6).map(([name, data]) => {
              const intentLabel = data.avgBuyIntent >= 70 ? 'Hot' : data.avgBuyIntent >= 40 ? 'Warm' : 'Cold';
              const intentClass = data.avgBuyIntent >= 70 ? 'hot' : data.avgBuyIntent >= 40 ? 'warm' : 'cold';
              return (
                <div key={name} className="portfolio-item">
                  <div className="portfolio-info">
                    <span className="portfolio-name">{name}</span>
                    <span className="portfolio-meetings">{data.count} meeting{data.count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="portfolio-score">
                    <div className="portfolio-bar">
                      <div
                        className={`portfolio-bar-fill ${intentClass}`}
                      />
                    </div>
                    <span className={`portfolio-badge ${intentClass}`}>{intentLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Coaching Insights</h3>
        <div className="insights-list">
          {allObservations.map((obs, idx) => (
            <div
              key={idx}
              className="insight-item insight-item--clickable"
              onClick={() => setSelectedObservation(obs.text)}
            >
              <span className="insight-text">{obs.text}</span>
              {obs.count > 1 && <span className="insight-count">×{obs.count}</span>}
              <span className="insight-expand">→</span>
            </div>
          ))}
        </div>
      </div>

      {competitorStats.length > 0 && (
        <div className="dashboard-section">
          <h3>Competitive Landscape</h3>
          <div className="competitor-stats">
            {competitorStats.map(comp => (
              <div key={comp.name} className={`competitor-stat-item sentiment-${comp.sentiment}`}>
                <div className="competitor-stat-main">
                  <span className="competitor-stat-name">{comp.name}</span>
                  <span className={`competitor-stat-sentiment sentiment-${comp.sentiment}`}>
                    {comp.sentiment}
                  </span>
                </div>
                <div className="competitor-stat-meta">
                  <span className="competitor-stat-count">{comp.count} mention{comp.count > 1 ? 's' : ''}</span>
                  <span className="competitor-stat-accounts">{comp.accountCount} account{comp.accountCount > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <h3>Recent Meetings</h3>
        <div className="recent-meetings">
          {sortedMeetings.slice(0, 5).map((m) => (
            <div
              key={m.id}
              className="recent-meeting-item"
              onClick={() => onSelectMeeting(m.id)}
            >
              <div className="recent-meeting-date">
                {m.meetingDate || new Date(m.createdAt).toLocaleDateString()}
              </div>
              <div className="recent-meeting-account">{m.accountName || 'Unknown'}</div>
              <span className={`intent-badge intent--${m.intent.primary.toLowerCase()}`}>
                {m.intent.primary}
              </span>
              <div className="recent-meeting-stats">
                <span title="Question Score">Q: {m.coaching.questionScore.score}%</span>
                <span title="Talk Ratio">T: {m.coaching.talkRatio.sellerPct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedObservation && (
        <CoachingModal
          observation={selectedObservation}
          sellerName={sellerName}
          metrics={{
            talkRatio: metrics.find(m => m.label === 'Talk Ratio')?.value,
            questionScore: metrics.find(m => m.label === 'Question Quality')?.value,
            avgBuyLikelihood: metrics.find(m => m.label === 'Avg Buy Likelihood')?.value,
          }}
          onClose={() => setSelectedObservation(null)}
        />
      )}
    </div>
  );
}
