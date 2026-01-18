import { useEffect, useMemo, useState, useCallback } from 'react';
import type {
  SalesTranscriptAnalysisRequest,
  SalesTranscriptAnalysisResponse,
  Team,
} from '@shared/schema';
import DraftEditor from '../components/DraftEditor';
import AccountAnalysis from '../components/AccountAnalysis';
import SalespersonDashboard from '../components/SalespersonDashboard';
import TeamManagement from '../components/TeamManagement';
import './analysis.css';

const parseParticipants = (raw: string) =>
  raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

const STORAGE_KEY = 'salesbuddy_analyses';

type ViewTab = 'meeting' | 'accounts' | 'salesperson' | 'teams';

const loadFromLocalStorage = (): Map<string, SalesTranscriptAnalysisResponse> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SalesTranscriptAnalysisResponse[];
      return new Map(parsed.map(item => [item.id, item]));
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return new Map();
};

const saveToLocalStorage = (analyses: Map<string, SalesTranscriptAnalysisResponse>) => {
  try {
    const arr = Array.from(analyses.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

export default function AnalysisPage() {
  const [meetingDate, setMeetingDate] = useState('');
  const [accountName, setAccountName] = useState('');
  const [participants, setParticipants] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] =
    useState<SalesTranscriptAnalysisResponse | null>(null);
  const [storedAnalyses, setStoredAnalyses] = useState<Map<string, SalesTranscriptAnalysisResponse>>(
    () => loadFromLocalStorage()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('meeting');
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);
  const [selectedSellerName, setSelectedSellerName] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState<Record<string, boolean>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);

  // Group analyses by account
  const accountGroups = useMemo(() => {
    const groups = new Map<string, SalesTranscriptAnalysisResponse[]>();
    storedAnalyses.forEach(analysis => {
      const name = analysis.accountName || 'Unnamed Account';
      const existing = groups.get(name) || [];
      existing.push(analysis);
      groups.set(name, existing);
    });
    // Sort each group by date
    groups.forEach((meetings) => {
      meetings.sort((a, b) => {
        const dateA = a.meetingDate ? new Date(a.meetingDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.meetingDate ? new Date(b.meetingDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
    });
    return groups;
  }, [storedAnalyses]);

  // Get unique seller names
  const sellerNames = useMemo(() => {
    const names = new Set<string>();
    storedAnalyses.forEach(analysis => {
      if (analysis.sellerName) {
        names.add(analysis.sellerName);
      }
    });
    return Array.from(names).sort();
  }, [storedAnalyses]);

  // Get meetings for selected seller
  const sellerMeetings = useMemo(() => {
    if (!selectedSellerName) return [];
    return Array.from(storedAnalyses.values()).filter(
      a => a.sellerName === selectedSellerName
    );
  }, [storedAnalyses, selectedSellerName]);

  // Save to localStorage whenever storedAnalyses changes
  useEffect(() => {
    saveToLocalStorage(storedAnalyses);
  }, [storedAnalyses]);

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams');
        if (response.ok) {
          const data = await response.json();
          setTeams(data);
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    };
    fetchTeams();
  }, []);

  const handleCreateTeam = async (name: string): Promise<Team> => {
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to create team');
    }
    return response.json();
  };

  const refreshTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (err) {
      console.error('Failed to refresh teams:', err);
    }
  };

  const addAnalysis = (newAnalysis: SalesTranscriptAnalysisResponse) => {
    setStoredAnalyses(prev => {
      const updated = new Map(prev);
      updated.set(newAnalysis.id, newAnalysis);
      return updated;
    });
  };

  const deleteAnalysis = (id: string) => {
    setStoredAnalyses(prev => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });
    if (selectedId === id) {
      setSelectedId(null);
      setAnalysis(null);
    }
  };

  const handleNewAnalysis = () => {
    setMeetingDate('');
    setAccountName('');
    setParticipants('');
    setSellerName('');
    setNotes('');
    setTranscript('');
    setAnalysis(null);
    setSelectedId(null);
    setActiveTab('meeting');
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const participantsList = parseParticipants(participants);
      const payload: SalesTranscriptAnalysisRequest & { teamId?: string } = {
        transcript,
        meetingDate: meetingDate || undefined,
        accountName: accountName || undefined,
        participants: participantsList.length ? participantsList : undefined,
        sellerName: sellerName || undefined,
        notes: notes || undefined,
        teamId: currentTeamId || undefined,
      };
      const response = await fetch('/api/sales/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body && typeof body.message === 'string'
            ? body.message
            : `Analyze failed (${response.status})`;
        throw new Error(message);
      }
      const data = (await response.json()) as SalesTranscriptAnalysisResponse;
      setAnalysis(data);
      setSelectedId(data.id);
      addAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to analyze transcript.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalysis = (id: string) => {
    const stored = storedAnalyses.get(id);
    if (stored) {
      setAnalysis(stored);
      setSelectedId(id);
      setActiveTab('meeting');
    }
  };

  const handleDeleteAnalysis = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this analysis?')) {
      deleteAnalysis(id);
    }
  };

  const toggleAccountExpand = (accountName: string) => {
    setSidebarExpanded(prev => ({
      ...prev,
      [accountName]: !prev[accountName],
    }));
  };

  const handleViewAccount = (accountName: string) => {
    setSelectedAccountName(accountName);
    setActiveTab('accounts');
  };

  const handleViewSeller = (sellerName: string) => {
    setSelectedSellerName(sellerName);
    setActiveTab('salesperson');
  };

  const canAnalyze = transcript.trim().length > 0 && !isLoading;

  const handleAiImprove = useCallback(async (content: string, type: 'email' | 'callScript'): Promise<string> => {
    const response = await fetch('/api/sales/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type }),
    });
    if (!response.ok) {
      throw new Error('Failed to improve content');
    }
    const data = await response.json();
    return data.improved;
  }, []);

  const extractSubject = (emailDraft: string): string | undefined => {
    const match = emailDraft.match(/^Subject:\s*(.+)$/im);
    return match ? match[1].trim() : undefined;
  };

  // Get account names sorted by most recent meeting
  const sortedAccountNames = useMemo(() => {
    const accountDates: [string, Date][] = [];
    accountGroups.forEach((meetings, name) => {
      const mostRecent = meetings[0];
      const date = mostRecent.meetingDate
        ? new Date(mostRecent.meetingDate)
        : new Date(mostRecent.createdAt);
      accountDates.push([name, date]);
    });
    return accountDates
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([name]) => name);
  }, [accountGroups]);

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <div className="brand__logo">S</div>
          <div className="brand__title">Salesbuddy CRM</div>
        </div>
        <div className="topbar__tabs">
          <button
            className={`tab-btn ${activeTab === 'meeting' ? 'active' : ''}`}
            onClick={() => setActiveTab('meeting')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Meeting
          </button>
          <button
            className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Accounts
          </button>
          <button
            className={`tab-btn ${activeTab === 'salesperson' ? 'active' : ''}`}
            onClick={() => setActiveTab('salesperson')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Salesperson
          </button>
          <button
            className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Teams
          </button>
        </div>
        <div className="topbar__actions">
          <select
            className="team-selector"
            value={currentTeamId || ''}
            onChange={(e) => setCurrentTeamId(e.target.value || null)}
          >
            <option value="">Personal</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            className="button secondary"
            type="button"
            onClick={handleNewAnalysis}
          >
            + New Meeting
          </button>
          <button
            className="button"
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      <div className="container">
        {error && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              borderColor: '#ef4444',
              gridColumn: '1 / -1',
            }}
          >
            <strong style={{ color: '#b91c1c' }}>Error:</strong> {error}
          </div>
        )}
        <aside className="card">
          <div className="aside__header">
            <div className="section-title">Accounts</div>
          </div>
          <div className="aside__list">
            {sortedAccountNames.length === 0 && (
              <p className="muted">No analyses yet.</p>
            )}
            {sortedAccountNames.map(accName => {
              const meetings = accountGroups.get(accName) || [];
              const isExpanded = sidebarExpanded[accName];
              const meetingCount = meetings.length;
              return (
                <div key={accName} className="account-group">
                  <div
                    className={`account-group-header ${selectedAccountName === accName && activeTab === 'accounts' ? 'is-active' : ''}`}
                    onClick={() => toggleAccountExpand(accName)}
                  >
                    <div className="account-group-expand">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
                      >
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    <div className="account-group-info">
                      <div className="account-group-name">{accName}</div>
                      <small>{meetingCount} meeting{meetingCount !== 1 ? 's' : ''}</small>
                    </div>
                    <button
                      type="button"
                      className="account-view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewAccount(accName);
                      }}
                      title="View account analysis"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="account-group-meetings">
                      {meetings.map(meeting => (
                        <div
                          key={meeting.id}
                          className={`list-item sub-item ${selectedId === meeting.id ? 'is-active' : ''}`}
                          onClick={() => loadAnalysis(meeting.id)}
                        >
                          <div className="list-item__content">
                            <div className="list-item__title">
                              {meeting.meetingDate || 'No date'}
                            </div>
                            <small>{meeting.intent.primary}</small>
                          </div>
                          <button
                            type="button"
                            className="list-item__delete"
                            onClick={(e) => handleDeleteAnalysis(e, meeting.id)}
                            title="Delete analysis"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sellerNames.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 24 }}>Salespeople</div>
              <div className="aside__list">
                {sellerNames.map(name => {
                  const count = Array.from(storedAnalyses.values()).filter(a => a.sellerName === name).length;
                  return (
                    <div
                      key={name}
                      className={`list-item ${selectedSellerName === name && activeTab === 'salesperson' ? 'is-active' : ''}`}
                      onClick={() => handleViewSeller(name)}
                    >
                      <div className="list-item__content">
                        <div className="list-item__title">{name}</div>
                        <small>{count} meeting{count !== 1 ? 's' : ''}</small>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <div>
          {/* Meeting View */}
          {activeTab === 'meeting' && (
            <>
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="section-title">Meeting details</div>
                <div className="grid">
                  <label>
                    Meeting date
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={event => setMeetingDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Account name
                    <input
                      type="text"
                      placeholder="Acme Corp"
                      value={accountName}
                      onChange={event => setAccountName(event.target.value)}
                      list="account-suggestions"
                    />
                    <datalist id="account-suggestions">
                      {sortedAccountNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Participants
                    <input
                      type="text"
                      placeholder="Alex (Sales), Jordan (Buyer)"
                      value={participants}
                      onChange={event => setParticipants(event.target.value)}
                    />
                  </label>
                  <label>
                    Seller name
                    <input
                      type="text"
                      placeholder="Alex"
                      value={sellerName}
                      onChange={event => setSellerName(event.target.value)}
                      list="seller-suggestions"
                    />
                    <datalist id="seller-suggestions">
                      {sellerNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                  <label className="span-2">
                    Notes
                    <input
                      type="text"
                      placeholder="Anything important from the call..."
                      value={notes}
                      onChange={event => setNotes(event.target.value)}
                    />
                  </label>
                  <label className="span-2">
                    Transcript
                    <textarea
                      rows={10}
                      placeholder="Paste transcript here..."
                      value={transcript}
                      onChange={event => setTranscript(event.target.value)}
                    />
                  </label>
                </div>
                <div className="actions">
                  <button
                    className="button"
                    type="button"
                    disabled={!canAnalyze}
                    onClick={handleAnalyze}
                  >
                    {isLoading ? 'Analyzing...' : 'Analyze transcript'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="section-title">Analysis results</div>
                {!analysis && (
                  <p className="muted">
                    Run an analysis to see intent scores and recommended follow-ups.
                  </p>
                )}
                {analysis && (
                  <div className="results">
                    <div className="results__summary">
                      <div className="badge">Account</div>
                      <h2>{analysis.accountName || 'Account'}</h2>
                      <p>{analysis.summary}</p>
                    </div>
                    <div className="pill-row">
                      <span className="pill">Primary: {analysis.intent.primary}</span>
                      <span className="pill">Buy now {analysis.intent.buyNow}%</span>
                      <span className="pill">
                        Buy soon {analysis.intent.buySoon}%
                      </span>
                      <span className="pill">Later {analysis.intent.later}%</span>
                      <span className="pill">No fit {analysis.intent.noFit}%</span>
                    </div>
                    <div className="results__grid">
                      <div>
                        <h4>Signals</h4>
                        <ul>
                          {analysis.signals.map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4>Blockers</h4>
                        <ul>
                          {analysis.blockers.map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Competitor Intelligence */}
                    {analysis.competitors && analysis.competitors.length > 0 && (
                      <div className="competitors-section">
                        <h4>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <path d="M20 8v6M23 11h-6"/>
                          </svg>
                          Competitor Intelligence
                        </h4>
                        <div className="competitor-list">
                          {analysis.competitors.map((comp, i) => (
                            <div key={i} className={`competitor-item sentiment-${comp.sentiment}`}>
                              <div className="competitor-header">
                                <span className="competitor-name">{comp.name}</span>
                                <span className={`competitor-sentiment sentiment-${comp.sentiment}`}>
                                  {comp.sentiment}
                                </span>
                              </div>
                              <p className="competitor-context">{comp.context}</p>
                              {comp.quote && comp.quote !== 'Enable AI for exact quotes' && (
                                <blockquote className="competitor-quote">"{comp.quote}"</blockquote>
                              )}
                            </div>
                          ))}
                        </div>
                        {analysis.competitorInsights && (
                          <div className="competitor-insights">
                            {analysis.competitorInsights.topThreat && (
                              <div className="top-threat">
                                <strong>Top Threat:</strong> {analysis.competitorInsights.topThreat}
                              </div>
                            )}
                            {analysis.competitorInsights.positioning && analysis.competitorInsights.positioning.length > 0 && (
                              <div className="positioning-tips">
                                <strong>Counter-Positioning:</strong>
                                <ul>
                                  {analysis.competitorInsights.positioning.map((tip, i) => (
                                    <li key={i}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <h4>Next steps</h4>
                      <ul>
                        {analysis.nextSteps.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="follow-up-section">
                      <h4>Follow-up</h4>
                      <div className="follow-up-timing">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{analysis.followUp.timing}</span>
                      </div>

                      <DraftEditor
                        title="Email Draft"
                        icon="email"
                        initialContent={analysis.followUp.emailDraft}
                        recipientLabel="To"
                        recipientValue={analysis.accountName ? `${analysis.accountName} Contact` : 'Prospect'}
                        subjectLine={extractSubject(analysis.followUp.emailDraft)}
                        onAiImprove={(content) => handleAiImprove(content, 'email')}
                      />

                      <DraftEditor
                        title="Call Script"
                        icon="phone"
                        initialContent={analysis.followUp.callScript}
                        onAiImprove={(content) => handleAiImprove(content, 'callScript')}
                      />
                    </div>
                    <div>
                      <h4>Coaching metrics</h4>
                      <p>
                        Talk ratio: seller {analysis.coaching.talkRatio.sellerPct}% (
                        {analysis.coaching.talkRatio.sellerWords} words) • customer{' '}
                        {analysis.coaching.talkRatio.customerPct}% (
                        {analysis.coaching.talkRatio.customerWords} words)
                      </p>
                      <p>
                        Question score: {analysis.coaching.questionScore.score}% open
                        questions ({analysis.coaching.questionScore.openQuestions}/
                        {analysis.coaching.questionScore.sellerQuestions})
                      </p>
                      <ul>
                        {analysis.coaching.observations.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Accounts View */}
          {activeTab === 'accounts' && (
            <div className="card">
              {!selectedAccountName ? (
                <div className="view-placeholder">
                  <div className="placeholder-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <h3>Select an Account</h3>
                  <p>Choose an account from the sidebar to view their deal progression and analysis.</p>
                  {sortedAccountNames.length > 0 && (
                    <div className="placeholder-accounts">
                      {sortedAccountNames.slice(0, 3).map(name => (
                        <button
                          key={name}
                          className="button secondary"
                          onClick={() => handleViewAccount(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <AccountAnalysis
                  accountName={selectedAccountName}
                  meetings={accountGroups.get(selectedAccountName) || []}
                  onSelectMeeting={loadAnalysis}
                />
              )}
            </div>
          )}

          {/* Salesperson View */}
          {activeTab === 'salesperson' && (
            <div className="card">
              {!selectedSellerName ? (
                <div className="view-placeholder">
                  <div className="placeholder-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h3>Select a Salesperson</h3>
                  <p>Choose a salesperson from the sidebar to view their performance metrics and coaching insights.</p>
                  {sellerNames.length > 0 && (
                    <div className="placeholder-accounts">
                      {sellerNames.slice(0, 3).map(name => (
                        <button
                          key={name}
                          className="button secondary"
                          onClick={() => handleViewSeller(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  {sellerNames.length === 0 && (
                    <p className="muted">No salespeople recorded yet. Add a seller name when analyzing meetings.</p>
                  )}
                </div>
              ) : (
                <SalespersonDashboard
                  sellerName={selectedSellerName}
                  meetings={sellerMeetings}
                  onSelectMeeting={loadAnalysis}
                />
              )}
            </div>
          )}

          {/* Teams View */}
          {activeTab === 'teams' && (
            <div className="card">
              <TeamManagement
                teams={teams}
                onCreateTeam={handleCreateTeam}
                onRefreshTeams={refreshTeams}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
