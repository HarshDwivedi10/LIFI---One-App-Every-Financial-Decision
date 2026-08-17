import { useState, useEffect } from 'react';
import { userCoachApi } from '../../services/api';
import toast from 'react-hot-toast';
import './HiredCoachView.css';

export default function HiredCoachView({ coach, onOpenChat }) {
  const [permission, setPermission] = useState('READ_ONLY');
  const [loadingPerm, setLoadingPerm] = useState(true);
  const [updatingPerm, setUpdatingPerm] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSug, setLoadingSug] = useState(true);

  const [pendingEdits, setPendingEdits] = useState([]);
  const [loadingEdits, setLoadingEdits] = useState(true);

  useEffect(() => {
    fetchPermission();
    fetchSuggestions();
    fetchPendingEdits();
  }, []);

  const fetchPermission = async () => {
    try {
      setLoadingPerm(true);
      const res = await userCoachApi.getPermission();
      setPermission(res.data.permission || 'READ_ONLY');
    } catch (err) {
      console.error('Failed to fetch permission:', err);
    } finally {
      setLoadingPerm(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setLoadingSug(true);
      const res = await userCoachApi.getSuggestions();
      setSuggestions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoadingSug(false);
    }
  };

  const fetchPendingEdits = async () => {
    try {
      setLoadingEdits(true);
      const res = await userCoachApi.getPendingEdits();
      setPendingEdits(res.data || []);
    } catch (err) {
      console.error('Failed to fetch pending edits:', err);
    } finally {
      setLoadingEdits(false);
    }
  };

  const handlePermissionChange = async (newPerm) => {
    if (newPerm === permission || updatingPerm) return;
    try {
      setUpdatingPerm(true);
      await userCoachApi.updatePermission(newPerm);
      setPermission(newPerm);
      toast.success(
        newPerm === 'READ_WRITE'
          ? 'Read & Edit permission granted to coach!'
          : 'Access updated to Read-Only mode!'
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to update permission setting.');
    } finally {
      setUpdatingPerm(false);
    }
  };

  const handleAcceptEdit = async (id) => {
    try {
      await userCoachApi.acceptPendingEdit(id);
      toast.success('Edit accepted and applied to your portfolio!');
      fetchPendingEdits();
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept edit.');
    }
  };

  const handleRejectEdit = async (id) => {
    try {
      await userCoachApi.rejectPendingEdit(id);
      toast.success('Edit proposal rejected.');
      fetchPendingEdits();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject edit.');
    }
  };

  const handleDownloadCV = () => {
    if (!coach?.resumeBase64) {
      toast.error('No CV uploaded by this coach.');
      return;
    }
    const link = document.createElement('a');
    link.href = coach.resumeBase64;
    link.download = `${coach.name.replace(/\s+/g, '_')}_CV.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloading ${coach.name}'s CV...`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="hired-coach-redesign">

      {/* Top Hero Banner */}
      <div className="hired-hero-banner">
        <div className="hero-left">
          <div className="avatar-ring">
            {coach?.profilePictureBase64 ? (
              <img src={coach.profilePictureBase64} alt={coach.name} />
            ) : (
              <div className="avatar-fallback">{coach?.name?.charAt(0).toUpperCase()}</div>
            )}
            <span className="status-dot" title="Active Hired Coach" />
          </div>

          <div className="hero-info">
            <span className="hired-status-badge">
              <span className="badge-pulse-dot" />
              ACTIVE COACH
            </span>
            <div className="coach-name-row">
              <h2>{coach?.name}</h2>
            </div>
            <p className="coach-designation">{coach?.title || 'Financial Planning Coach'}</p>
            <div className="coach-meta-line">
              {coach?.location && (
                <span className="meta-item">{coach.location}</span>
              )}
              <span className="meta-item">{coach?.yearsExperience || '8+ Years Experience'}</span>
              <span className="meta-item">
                {coach?.rating || 4.9} ({coach?.clientCount || '120+ Clients'})
              </span>
            </div>
          </div>
        </div>

        <div className="hero-actions">
          {coach?.resumeBase64 && (
            <button className="download-cv-btn" onClick={handleDownloadCV}>
              <span>View / Download CV</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="hired-main-grid">

        {/* Left Column: Permission Settings */}
        <div className="grid-column-left">

          {/* Section 1: Access Permission Controls */}
          <div className="section-card perm-section">
            <div className="card-header">
              <div className="header-title-group">
                <h3 className="section-heading-with-icon">
                  <span>Coach Access &amp; Permissions</span>
                </h3>
                <p>Control the level of access your coach has on your financial data.</p>
              </div>
              <span className={`perm-badge-tag ${permission === 'READ_WRITE' ? 'rw' : 'ro'}`}>
                {permission === 'READ_WRITE' ? 'Read & Edit Enabled' : 'Read-Only Mode'}
              </span>
            </div>

            {loadingPerm ? (
              <div className="loading-placeholder">Loading permission settings...</div>
            ) : (
              <div className="perm-cards-container">

                {/* Option 1: READ_ONLY */}
                <div
                  className={`perm-choice-card ${permission === 'READ_ONLY' ? 'active-choice' : ''}`}
                  onClick={() => handlePermissionChange('READ_ONLY')}
                >
                  <div className="choice-radio">
                    <input
                      type="radio"
                      name="coach-perm-radio"
                      checked={permission === 'READ_ONLY'}
                      onChange={() => handlePermissionChange('READ_ONLY')}
                    />
                  </div>
                  <div className="choice-body">
                    <div className="choice-title">
                      <div className="title-left">
                        <span>Allow Coach to READ Data</span>
                      </div>
                      {permission === 'READ_ONLY' && <span className="active-pill">ACTIVE MODE</span>}
                    </div>
                    <p className="choice-desc">
                      Coach can view your entire portal (Income, Expenses, Funds, Retirement, Goals) to analyze your finances, but cannot make any edits.
                    </p>
                  </div>
                </div>

                {/* Option 2: READ_WRITE */}
                <div
                  className={`perm-choice-card ${permission === 'READ_WRITE' ? 'active-choice' : ''}`}
                  onClick={() => handlePermissionChange('READ_WRITE')}
                >
                  <div className="choice-radio">
                    <input
                      type="radio"
                      name="coach-perm-radio"
                      checked={permission === 'READ_WRITE'}
                      onChange={() => handlePermissionChange('READ_WRITE')}
                    />
                  </div>
                  <div className="choice-body">
                    <div className="choice-title">
                      <div className="title-left">
                        <span>Allow Coach to READ &amp; EDIT Data</span>
                      </div>
                      {permission === 'READ_WRITE' && <span className="active-pill rw">ACTIVE MODE</span>}
                    </div>
                    <p className="choice-desc">
                      Coach can view your portal and propose edits to your funds or goals. Any edit made by the coach requires your explicit approval before taking effect.
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Right Column: Coach Financial Advice & Suggestions */}
        <div className="grid-column-right">
          <div className="section-card sug-section">
            <div className="card-header">
              <div className="header-title-group">
                <h3 className="section-heading-with-icon">
                  <span>Coach Financial Advice ({suggestions.length})</span>
                </h3>
                <p>Personalized recommendations from your coach.</p>
              </div>
            </div>

            {loadingSug ? (
              <div className="loading-placeholder">Loading coach advice...</div>
            ) : suggestions.length === 0 ? (
              <div className="empty-state-box advice-empty">
                <h4>No Advice Posted Yet</h4>
                <p>Your coach will review your financial portal and post personalized recommendations here.</p>
              </div>
            ) : (
              <div className="suggestions-feed">
                {suggestions.map(sug => (
                  <div key={sug.id} className="advice-card">
                    <div className="advice-header">
                      <span className="category-pill">{sug.category || 'General Advice'}</span>
                      <span className="advice-time">{formatDate(sug.createdAt)}</span>
                    </div>
                    <p className="advice-content">"{sug.suggestionText}"</p>
                    <div className="advice-footer">
                      <span className="coach-sig">Suggested by Coach {sug.coachName || coach?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Full Width Section: Proposed Changes Requiring Approval */}
      <div className="section-card pending-section full-width-section">
        <div className="card-header">
          <div className="header-title-group">
            <h3 className="section-heading-with-icon">
              <span>Proposed Changes Requiring Approval ({pendingEdits.length})</span>
            </h3>
            <p>Review and approve changes proposed by your coach.</p>
          </div>
        </div>

        {loadingEdits ? (
          <div className="loading-placeholder">Checking pending edit requests...</div>
        ) : pendingEdits.length === 0 ? (
          <div className="empty-state-box">
            <h4>No Pending Changes</h4>
            <p>There are currently no proposed edits awaiting your approval.</p>
          </div>
        ) : (
          <div className="pending-items-list">
            {pendingEdits.map(edit => (
              <div key={edit.id} className="pending-edit-item">
                <div className="edit-info">
                  <span className="entity-tag">{edit.targetEntity || 'PORTFOLIO'}</span>
                  <p className="edit-text">{edit.description}</p>
                  <span className="edit-timestamp">{formatDate(edit.createdAt)}</span>
                </div>

                <div className="edit-actions-group">
                  <button className="accept-action-btn" onClick={() => handleAcceptEdit(edit.id)}>
                    Accept &amp; Apply
                  </button>
                  <button className="reject-action-btn" onClick={() => handleRejectEdit(edit.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
