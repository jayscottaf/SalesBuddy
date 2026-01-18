import { useEffect, useState } from 'react';
import type { Team, TeamMember } from '@shared/schema';
import './TeamManagement.css';

interface Props {
  teams: Team[];
  currentUserId?: string;
  onCreateTeam: (name: string) => Promise<Team>;
  onRefreshTeams: () => void;
}

export default function TeamManagement({
  teams,
  currentUserId,
  onCreateTeam,
  onRefreshTeams,
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTeam) {
      fetchMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const team = await onCreateTeam(newTeamName.trim());
      setNewTeamName('');
      setShowCreateForm(false);
      setSelectedTeam(team);
      onRefreshTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedTeam) return;

    setIsInviting(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to invite member');
      }

      setInviteEmail('');
      fetchMembers(selectedTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  const isOwner = (team: Team) => {
    return team.ownerId === currentUserId;
  };

  if (selectedTeam) {
    return (
      <div className="team-management">
        <div className="team-detail">
          <div className="team-detail-header">
            <button
              type="button"
              className="back-btn"
              onClick={() => setSelectedTeam(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Teams
            </button>
          </div>

          <div className="team-detail-title">
            <h2>{selectedTeam.name}</h2>
            {isOwner(selectedTeam) && (
              <span className="role-badge owner">Owner</span>
            )}
          </div>

          {error && (
            <div className="team-error">{error}</div>
          )}

          {isOwner(selectedTeam) && (
            <form className="invite-form" onSubmit={handleInviteMember}>
              <input
                type="email"
                placeholder="Enter email to invite..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInviting}
              />
              <button
                type="submit"
                className="button"
                disabled={isInviting || !inviteEmail.trim()}
              >
                {isInviting ? 'Inviting...' : 'Invite'}
              </button>
            </form>
          )}

          <div className="members-section">
            <h3>Members</h3>
            {loadingMembers ? (
              <p className="muted">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="muted">No members yet</p>
            ) : (
              <div className="members-list">
                {members.map((member) => (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {member.userId.charAt(0).toUpperCase()}
                      </div>
                      <span className="member-id">{member.userId}</span>
                    </div>
                    <span className={`role-badge ${member.role}`}>
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-management">
      <div className="team-management-header">
        <h2>Teams</h2>
        <button
          type="button"
          className="button"
          onClick={() => setShowCreateForm(true)}
        >
          + Create Team
        </button>
      </div>

      {error && (
        <div className="team-error">{error}</div>
      )}

      {showCreateForm && (
        <form className="create-team-form" onSubmit={handleCreateTeam}>
          <input
            type="text"
            placeholder="Team name..."
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            autoFocus
            disabled={isCreating}
          />
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setShowCreateForm(false);
                setNewTeamName('');
              }}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={isCreating || !newTeamName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3>No Teams Yet</h3>
          <p>Create a team to collaborate with your colleagues and share meeting analyses.</p>
        </div>
      ) : (
        <div className="teams-list">
          {teams.map((team) => (
            <div
              key={team.id}
              className="team-card"
              onClick={() => setSelectedTeam(team)}
            >
              <div className="team-card-info">
                <h3>{team.name}</h3>
                <span className="team-created">
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="team-card-meta">
                {isOwner(team) ? (
                  <span className="role-badge owner">Owner</span>
                ) : (
                  <span className="role-badge member">Member</span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
