import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './CoachManagement.css';
import '../Admin/AdminDashboard.css';

// ─── Status Badge ─────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const cls = s === 'ACTIVE' ? 'active'
            : s === 'PENDING' ? 'pending'
            : s === 'SUSPENDED' ? 'suspended'
            : s === 'REJECTED' ? 'rejected'
            : 'pending';
  const icon = s === 'ACTIVE' ? '✓'
             : s === 'PENDING' ? '⏳'
             : s === 'SUSPENDED' ? '⏸'
             : s === 'REJECTED' ? '✕'
             : '•';
  return <span className={`status-badge ${cls}`}>{icon} {s}</span>;
}

// ─── Profile Modal ────────────────────────────────────
function ProfileModal({ coach, onClose, onAction }) {
  if (!coach) return null;
  const initials = (coach.name || 'C').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <div className="modal-avatar">{initials}</div>
          <div className="modal-header-info">
            <h2>{coach.name || '–'}</h2>
            <p>{coach.email}</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="modal-section">
          <div className="modal-section-title">Account Information</div>
          <div className="modal-field-grid">
            <div className="modal-field">
              <label>Status</label>
              <span><StatusBadge status={coach.status} /></span>
            </div>
            <div className="modal-field">
              <label>Applied On</label>
              <span>{coach.createdAt || '–'}</span>
            </div>
          </div>
        </div>

        {/* Professional Info */}
        <div className="modal-section">
          <div className="modal-section-title">Professional Details</div>
          <div className="modal-field-grid">
            <div className="modal-field full-width">
              <label>Resume</label>
              <span>
                {coach.resumeBase64 ? (
                  <a href={coach.resumeBase64} download={`${coach.name}_Resume`} target="_blank" rel="noreferrer" style={{color: '#a78bfa', textDecoration: 'underline'}}>
                    Download / View Resume
                  </a>
                ) : 'No resume provided'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {coach.status === 'PENDING' && (
            <>
              <button className="modal-action-btn approve" onClick={() => onAction('approve', coach)}>✓ Approve</button>
              <button className="modal-action-btn reject" onClick={() => onAction('reject', coach)}>✕ Reject</button>
            </>
          )}
          {coach.status === 'ACTIVE' && (
            <button className="modal-action-btn suspend" onClick={() => onAction('suspend', coach)}>⏸ Suspend</button>
          )}
          {coach.status === 'SUSPENDED' && (
            <button className="modal-action-btn activate" onClick={() => onAction('activate', coach)}>▶ Activate</button>
          )}
          <button className="modal-action-btn delete" onClick={() => onAction('delete', coach)}>🗑 Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation Dialog ──────────────────────────────
function ConfirmDialog({ title, message, icon, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-buttons">
          <button className="confirm-btn cancel" onClick={onCancel}>Cancel</button>
          <button className={`confirm-btn ${confirmStyle}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//   MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function CoachManagement() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch coaches ──
  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (search.trim()) {
        res = await api.get('/admin/coaches/search', { params: { keyword: search.trim() } });
      } else if (filter !== 'ALL') {
        res = await api.get('/admin/coaches/filter', { params: { status: filter } });
      } else {
        res = await api.get('/admin/coaches');
      }
      setCoaches(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load coaches.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchCoaches(), search ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [fetchCoaches, search]);

  // ── Counts (for filter tabs) ──
  const counts = {
    ALL: coaches.length,
    PENDING: coaches.filter(c => c.status === 'PENDING').length,
    ACTIVE: coaches.filter(c => c.status === 'ACTIVE').length,
    SUSPENDED: coaches.filter(c => c.status === 'SUSPENDED').length,
  };

  // ── Perform action ──
  const performAction = async (action, coach) => {
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await api.delete(`/admin/coaches/${coach.userId}`);
        toast.success(`${coach.name} deleted successfully`);
      } else {
        await api.put(`/admin/coaches/${coach.userId}/${action}`);
        const label = action.charAt(0).toUpperCase() + action.slice(1);
        toast.success(`${coach.name} ${label.toLowerCase()}d successfully`);
      }
      setSelectedCoach(null);
      setConfirm(null);
      fetchCoaches();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} coach`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Action handler (shows confirm for destructive actions) ──
  const handleAction = (action, coach) => {
    const destructive = ['delete', 'reject', 'suspend'];
    if (destructive.includes(action)) {
      const configs = {
        delete: { title: 'Delete Coach', message: `Are you sure you want to permanently delete ${coach.name}? This cannot be undone.`, icon: '🗑️', label: 'Delete', style: 'danger' },
        reject: { title: 'Reject Application', message: `Reject the coach application from ${coach.name}? They will not be able to login.`, icon: '✕', label: 'Reject', style: 'danger' },
        suspend: { title: 'Suspend Coach', message: `Suspend ${coach.name}? They will be unable to login until reactivated.`, icon: '⏸️', label: 'Suspend', style: 'warn' },
      };
      const cfg = configs[action];
      setConfirm({
        title: cfg.title,
        message: cfg.message,
        icon: cfg.icon,
        confirmLabel: cfg.label,
        confirmStyle: cfg.style,
        onConfirm: () => performAction(action, coach),
      });
    } else {
      performAction(action, coach);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const adminInitials = (user?.name || 'A').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="admin-dashboard">
      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            FinancePlanner
          </div>
          <span className="admin-badge">Admin</span>

          {/* Nav Tabs */}
          <nav className="admin-nav-tabs">
            <Link to="/admin" className="admin-nav-tab">📊 Dashboard</Link>
            <Link to="/admin/coaches" className="admin-nav-tab active">🎓 Coach Mgt</Link>
            <Link to="/admin/users" className="admin-nav-tab">👥 User Mgt</Link>
          </nav>
        </div>
        <div className="admin-header-right">
          <div className="admin-avatar">{adminInitials}</div>
          <button className="admin-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="admin-content">
        {/* ── Title ── */}
        <div className="admin-title-row">
          <h1>Coach Management</h1>
          <p>Manage coach applications, profiles, and statuses.</p>
        </div>

        {/* ── Toolbar: Filter Tabs + Search ── */}
        <div className="coach-toolbar">
          <div className="filter-tabs">
            {['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED'].map(f => (
              <button
                key={f}
                className={`filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => { setFilter(f); setSearch(''); }}
              >
                {f === 'ALL' ? '📋 All' : f === 'PENDING' ? '⏳ Pending' : f === 'ACTIVE' ? '✅ Approved' : '⏸ Suspended'}
                {filter === 'ALL' && f !== 'ALL' ? null : (
                  <span className="filter-count">{filter === 'ALL' ? counts[f] : coaches.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, email, expertise…"
              value={search}
              onChange={e => { setSearch(e.target.value); setFilter('ALL'); }}
            />
          </div>
        </div>

        {/* ── Result count ── */}
        {!loading && !error && (
          <div className="result-count">
            Showing <strong>{coaches.length}</strong> coach{coaches.length !== 1 ? 'es' : ''}
            {search && <> matching "<strong>{search}</strong>"</>}
            {filter !== 'ALL' && !search && <> with status <strong>{filter}</strong></>}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="admin-loading">
            <div className="spinner" />
            <p>Loading coaches…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="admin-error">
            <p>⚠️ {error}</p>
            <button className="retry-btn" onClick={fetchCoaches}>Retry</button>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && !error && coaches.length === 0 && (
          <div className="coach-table-card">
            <div className="empty-state">
              <div className="empty-state-icon">🎓</div>
              <h3>No coaches found</h3>
              <p>{search ? 'Try a different search term.' : filter !== 'ALL' ? 'No coaches with this status.' : 'No coach applications yet.'}</p>
            </div>
          </div>
        )}

        {!loading && !error && coaches.length > 0 && (
          <div className="coach-table-card">
            <table className="coach-table">
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>Resume</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coaches.map(coach => {
                  const initials = (coach.name || 'C').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                  return (
                    <tr key={coach.userId}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>{initials}</div>
                          <div className="user-cell-info">
                            <div className="user-cell-name">{coach.name || '–'}</div>
                            <div className="user-cell-email">{coach.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {coach.resumeBase64 ? (
                          <a href={coach.resumeBase64} download={`${coach.name}_Resume`} target="_blank" rel="noreferrer" style={{color: '#a78bfa', textDecoration: 'none', fontWeight: 600}}>
                            📄 View Resume
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>No Resume</span>
                        )}
                      </td>
                      <td><StatusBadge status={coach.status} /></td>
                      <td style={{ color: '#475569' }}>{coach.createdAt}</td>
                      <td>
                        <div className="action-group">
                          <button className="action-btn view" onClick={() => setSelectedCoach(coach)} title="View Profile">👁</button>
                          {coach.status === 'PENDING' && (
                            <>
                              <button className="action-btn approve" onClick={() => handleAction('approve', coach)} title="Approve">✓</button>
                              <button className="action-btn reject" onClick={() => handleAction('reject', coach)} title="Reject">✕</button>
                            </>
                          )}
                          {coach.status === 'ACTIVE' && (
                            <button className="action-btn suspend" onClick={() => handleAction('suspend', coach)} title="Suspend">⏸</button>
                          )}
                          {coach.status === 'SUSPENDED' && (
                            <button className="action-btn activate" onClick={() => handleAction('activate', coach)} title="Activate">▶</button>
                          )}
                          <button className="action-btn delete" onClick={() => handleAction('delete', coach)} title="Delete">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Profile Modal ── */}
      {selectedCoach && (
        <ProfileModal
          coach={selectedCoach}
          onClose={() => setSelectedCoach(null)}
          onAction={(action, coach) => {
            setSelectedCoach(null);
            handleAction(action, coach);
          }}
        />
      )}

      {/* ── Confirmation Dialog ── */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          icon={confirm.icon}
          confirmLabel={confirm.confirmLabel}
          confirmStyle={confirm.confirmStyle}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
