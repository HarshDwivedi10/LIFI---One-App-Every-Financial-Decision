import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import '../Admin/AdminDashboard.css';
import '../Admin/CoachManagement.css'; // Reusing toolbar & table styles

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

// ─── Role Badge ─────────────────────────────────────
function RoleBadge({ role }) {
  const s = (role || '').toUpperCase();
  const label = s === 'ROLE_ADMIN' ? 'Admin' : s === 'ROLE_COACH' ? 'Coach' : 'User';
  const cls = s === 'ROLE_ADMIN' ? 'badge-admin' : s === 'ROLE_COACH' ? 'badge-coach' : 'badge-user';
  return <span className={`badge ${cls}`}>{label}</span>;
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

// ─── Assign Coach Modal ──────────────────────────────
function AssignCoachModal({ userTarget, onClose, onAssign }) {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/coaches/filter?status=ACTIVE')
      .then(res => setCoaches(res.data))
      .catch(err => toast.error('Failed to load coaches'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()} style={{ width: '480px', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Assign Coach to {userTarget.name}</h3>
        {loading ? (
          <p>Loading coaches...</p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
            {coaches.length === 0 ? <p>No active coaches available.</p> : null}
            {coaches.map(c => (
              <div key={c.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{c.areaOfExpertise || 'General'}</div>
                </div>
                <button className="action-btn approve" onClick={() => onAssign(c.userId)}>Assign</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <button className="confirm-btn cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Change Role Modal ──────────────────────────────
function ChangeRoleModal({ userTarget, onClose, onChangeRole }) {
  const [newRole, setNewRole] = useState(userTarget.role.replace('ROLE_', ''));

  const handleSave = () => {
    onChangeRole(`ROLE_${newRole}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()} style={{ width: '400px', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Change Role for {userTarget.name}</h3>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Select New Role:</label>
          <select 
            value={newRole} 
            onChange={e => setNewRole(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <option value="USER">User</option>
            <option value="COACH">Coach</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="confirm-btn cancel" onClick={onClose}>Cancel</button>
          <button className="confirm-btn success" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//   MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function UserManagement() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [confirm, setConfirm] = useState(null);
  const [assignCoachUser, setAssignCoachUser] = useState(null);
  const [changeRoleUser, setChangeRoleUser] = useState(null);

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        size: 10,
        role: filterRole,
        status: filterStatus
      };
      if (search.trim()) {
        params.keyword = search.trim();
      }
      
      const res = await api.get('/admin/users', { params });
      setUsersList(res.data.content || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalElements(res.data.totalElements || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus, search, page]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers]);

  // ── Actions ──
  const handleAssignCoach = async (userId, coachId) => {
    try {
      await api.put(`/admin/users/${userId}/assign-coach?coachId=${coachId}`);
      toast.success('Coach assigned successfully');
      setAssignCoachUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign coach');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/change-role?newRole=${newRole}`);
      toast.success('Role changed successfully');
      setChangeRoleUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change role');
    }
  };

  const performAction = async (action, u) => {
    try {
      if (action === 'delete') {
        await api.delete(`/admin/users/${u.id}`);
        toast.success(`User ${u.name} deleted successfully`);
      } else if (action === 'suspend') {
        await api.put(`/admin/users/${u.id}/suspend`);
        toast.success(`User suspended`);
      } else if (action === 'activate') {
        await api.put(`/admin/users/${u.id}/activate`);
        toast.success(`User activated`);
      } else if (action === 'remove-coach') {
        await api.put(`/admin/users/${u.id}/remove-coach`);
        toast.success(`Coach removed successfully`);
      } else {
        await api.put(`/admin/users/${u.id}/${action}`);
        const label = action.charAt(0).toUpperCase() + action.slice(1);
        toast.success(`${u.name} ${label.toLowerCase()}d successfully`);
      }
      setConfirm(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  const confirmAction = (action, u) => {
    const configs = {
      delete: { title: 'Delete User', message: `Are you sure you want to delete ${u.name}? All user data will be permanently removed.`, icon: '🗑️', label: 'Delete', style: 'danger' },
      suspend: { title: 'Suspend User', message: `Suspend ${u.name}? They will be unable to login.`, icon: '⏸️', label: 'Suspend', style: 'warn' },
      activate: { title: 'Activate User', message: `Activate ${u.name}? They will be able to login again.`, icon: '▶️', label: 'Activate', style: 'success' },
      'remove-coach': { title: 'Remove Coach', message: `Remove the assigned coach from ${u.name}?`, icon: '❌', label: 'Remove', style: 'danger' },
    };
    const cfg = configs[action];
    setConfirm({
      ...cfg,
      confirmLabel: cfg.label,
      confirmStyle: cfg.style,
      onConfirm: () => performAction(action, u)
    });
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const adminInitials = (currentUser?.name || 'A').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            FinancePlanner
          </div>
          <span className="admin-badge">Admin</span>

          <nav className="admin-nav-tabs">
            <Link to="/admin" className="admin-nav-tab">📊 Dashboard</Link>
            <Link to="/admin/coaches" className="admin-nav-tab">🎓 Coach Mgt</Link>
            <Link to="/admin/users" className="admin-nav-tab active">👥 User Mgt</Link>
          </nav>
        </div>
        <div className="admin-header-right">
          <div className="admin-avatar">{adminInitials}</div>
          <button className="admin-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="admin-content">
        <div className="admin-title-row">
          <h1>User Management</h1>
          <p>Manage all users, their roles, coaches, and view their financial summaries.</p>
        </div>

        <div className="coach-toolbar" style={{ justifyContent: 'flex-start' }}>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          
          <select 
            value={filterRole} 
            onChange={e => { setFilterRole(e.target.value); setPage(0); }}
            className="filter-dropdown"
            style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <option value="ALL">All Roles</option>
            <option value="ROLE_USER">User</option>
            <option value="ROLE_COACH">Coach</option>
            <option value="ROLE_ADMIN">Admin</option>
          </select>

          <select 
            value={filterStatus} 
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="filter-dropdown"
            style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {!loading && !error && (
          <div className="result-count">
            Showing page <strong>{page + 1}</strong> of {totalPages} (<strong>{totalElements}</strong> total users)
          </div>
        )}

        {loading && (
          <div className="admin-loading">
            <div className="spinner" />
            <p>Loading users…</p>
          </div>
        )}

        {error && (
          <div className="admin-error">
            <p>⚠️ {error}</p>
            <button className="retry-btn" onClick={fetchUsers}>Retry</button>
          </div>
        )}

        {!loading && !error && usersList.length === 0 && (
          <div className="coach-table-card">
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <h3>No users found</h3>
              <p>Try adjusting your search or filters.</p>
            </div>
          </div>
        )}

        {!loading && !error && usersList.length > 0 && (
          <div className="coach-table-card">
            <table className="coach-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role & Status</th>
                  <th>Contact</th>
                  <th>Financial Summary</th>
                  <th>Assigned Coach</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => {
                  const initials = (u.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar-sm" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>{initials}</div>
                          <div className="user-cell-info">
                            <div className="user-cell-name">{u.name || '–'}</div>
                            <div className="user-cell-email" style={{ fontSize: '0.7rem' }}>Joined: {u.registrationDate}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                          <RoleBadge role={u.role} />
                          <StatusBadge status={u.status} />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                          <div style={{ marginBottom: '0.2rem' }}>📧 {u.email}</div>
                          <div>📱 {u.phone}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 1rem' }}>
                          <div>Income: <span style={{ color: '#34d399' }}>{formatCurrency(u.totalIncome)}</span></div>
                          <div>Expenses: <span style={{ color: '#f87171' }}>{formatCurrency(u.totalExpenses)}</span></div>
                          <div>Assets: <span style={{ color: '#60a5fa' }}>{formatCurrency(u.totalAssets)}</span></div>
                          <div>Goals: <span style={{ color: '#fbbf24' }}>{u.goalCount}</span></div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.75rem', color: u.assignedCoachName ? '#a78bfa' : '#475569' }}>
                          {u.assignedCoachName ? `🎓 ${u.assignedCoachName}` : 'No Coach'}
                        </div>
                      </td>
                      <td>
                        <div className="action-group">
                          <button className="action-btn view" onClick={() => setAssignCoachUser(u)} title="Assign Coach">🎓</button>
                          {u.assignedCoachId && (
                            <button className="action-btn reject" onClick={() => confirmAction('remove-coach', u)} title="Remove Coach">❌</button>
                          )}
                          <button className="action-btn approve" onClick={() => setChangeRoleUser(u)} title="Change Role">⚙️</button>
                          {u.status === 'ACTIVE' && (
                            <button className="action-btn suspend" onClick={() => confirmAction('suspend', u)} title="Suspend">⏸</button>
                          )}
                          {u.status === 'SUSPENDED' && (
                            <button className="action-btn activate" onClick={() => confirmAction('activate', u)} title="Activate">▶</button>
                          )}
                          <button className="action-btn reject" onClick={() => confirmAction('delete', u)} title="Delete User">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Controls ── */}
        {!loading && !error && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button 
              className="action-btn view" 
              disabled={page === 0} 
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', color: '#e2e8f0' }}>Page {page + 1} of {totalPages}</span>
            <button 
              className="action-btn view" 
              disabled={page === totalPages - 1} 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
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

      {assignCoachUser && (
        <AssignCoachModal
          userTarget={assignCoachUser}
          onClose={() => setAssignCoachUser(null)}
          onAssign={(coachId) => handleAssignCoach(assignCoachUser.id, coachId)}
        />
      )}

      {changeRoleUser && (
        <ChangeRoleModal
          userTarget={changeRoleUser}
          onClose={() => setChangeRoleUser(null)}
          onChangeRole={(newRole) => handleChangeRole(changeRoleUser.id, newRole)}
        />
      )}
    </div>
  );
}
