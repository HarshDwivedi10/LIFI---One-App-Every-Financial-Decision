import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import './AdminDashboard.css';
import './CoachManagement.css';

// ─── colour palette for charts ───────────────────────
const PIE_COLORS_RATIO  = ['#60a5fa', '#a78bfa'];
const PIE_COLORS_STATUS = ['#34d399', '#fbbf24'];

// ─── Custom Tooltip ──────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="custom-tooltip">
      {label && <p className="label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="value" style={{ color: p.color || '#a78bfa' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────
function StatusBadge({ status }) {
  const cls = status === 'ACTIVE' ? 'badge badge-active'
            : status === 'PENDING' ? 'badge badge-pending'
            : 'badge badge-user';
  return <span className={cls}>{status === 'ACTIVE' ? '✓' : '⏳'} {status}</span>;
}

// ─── Role Badge ───────────────────────────────────────
function RoleBadge({ role }) {
  const label = role === 'ROLE_ADMIN' ? 'Admin'
              : role === 'ROLE_COACH' ? 'Coach'
              : 'User';
  const cls = role === 'ROLE_COACH' ? 'badge badge-coach' : 'badge badge-user';
  return <span className={cls}>{label}</span>;
}

// ─── Stat Card ────────────────────────────────────────
function StatCard({ icon, label, value, accent, format = 'number' }) {
  const displayValue = format === 'currency'
    ? `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : Number(value || 0).toLocaleString();

  return (
    <div className="stat-card" style={{ '--card-accent': accent }}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: `${accent.replace('linear-gradient(135deg, ', '').split(',')[0]}22` }}>
          {icon}
        </div>
      </div>
      <div className="stat-value">{displayValue}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────
function UserRow({ user }) {
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return (
    <tr>
      <td>
        <div className="user-cell">
          <div className="user-avatar-sm">{initials}</div>
          <div className="user-cell-info">
            <div className="user-cell-name">{user.name || '–'}</div>
            <div className="user-cell-email">{user.email}</div>
          </div>
        </div>
      </td>
      <td><RoleBadge role={user.role} /></td>
      <td><StatusBadge status={user.status} /></td>
      <td style={{ color: '#475569' }}>{user.createdAt}</td>
    </tr>
  );
}

// ─── Coach Row ────────────────────────────────────────
function CoachRow({ coach }) {
  const initials = (coach.name || 'C').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return (
    <tr>
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
    </tr>
  );
}

// ═══════════════════════════════════════════════════
//   MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const adminInitials = (user?.name || 'A').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  // ── Loading ──
  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-content">
          <div className="admin-error">
            <p>⚠️ {error}</p>
            <button className="retry-btn" onClick={fetchDashboard}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const { stats = {}, charts = {}, tables = {} } = data || {};

  return (
    <div className="admin-dashboard">
      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            LiFi
          </div>
          <span className="admin-badge">Admin</span>

          {/* Nav Tabs */}
          <nav className="admin-nav-tabs">
            <Link to="/admin" className="admin-nav-tab active">📊 Dashboard</Link>
            <Link to="/admin/coaches" className="admin-nav-tab">🎓 Coach Mgt</Link>
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
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {user?.name || 'Admin'} — here's your platform overview.</p>
        </div>

        {/* ═══════════ STAT CARDS ═══════════ */}
        <div className="stats-grid">
          <StatCard
            icon="👥"
            label="Total Users"
            value={stats.totalUsers}
            accent="linear-gradient(135deg, #60a5fa, #3b82f6)"
          />
          <StatCard
            icon="🎓"
            label="Total Coaches"
            value={stats.totalCoaches}
            accent="linear-gradient(135deg, #a78bfa, #7c3aed)"
          />
          <StatCard
            icon="⏳"
            label="Pending Requests"
            value={stats.pendingCoachRequests}
            accent="linear-gradient(135deg, #fbbf24, #f59e0b)"
          />
          <StatCard
            icon="✅"
            label="Active Coaches"
            value={stats.activeCoaches}
            accent="linear-gradient(135deg, #34d399, #10b981)"
          />
          <StatCard
            icon="💳"
            label="Total Transactions"
            value={stats.totalTransactions}
            accent="linear-gradient(135deg, #f472b6, #ec4899)"
          />

        </div>

        {/* ═══════════ CHARTS ═══════════ */}
        <div className="charts-grid">
          {/* Monthly User Registrations */}
          <div className="chart-card">
            <h3>📈 Monthly User Registrations</h3>
            {(charts.monthlyUserRegistrations || []).length === 0 ? (
              <div className="no-data">📊 No registration data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={charts.monthlyUserRegistrations} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Registrations" stroke="#7c3aed" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* User vs Coach Ratio */}
          <div className="chart-card">
            <h3>🥧 User vs Coach Ratio</h3>
            {(charts.userCoachRatio || []).every(d => d.value === 0) ? (
              <div className="no-data">📊 No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.userCoachRatio || []}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(charts.userCoachRatio || []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS_RATIO[i % PIE_COLORS_RATIO.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{val}</span>}
                    iconType="circle" iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Active vs Pending Coaches */}
          <div className="chart-card">
            <h3>🔄 Coach Status</h3>
            {(charts.activeVsPendingCoaches || []).every(d => d.value === 0) ? (
              <div className="no-data">📊 No coaches yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.activeVsPendingCoaches || []}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(charts.activeVsPendingCoaches || []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS_STATUS[i % PIE_COLORS_STATUS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{val}</span>}
                    iconType="circle" iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ═══════════ TABLES ═══════════ */}
        <div className="tables-grid">
          {/* Recent Users */}
          <div className="table-card">
            <h3>👥 Recent Registered Users</h3>
            {(tables.recentUsers || []).length === 0 ? (
              <p className="empty-table">No users registered yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.recentUsers.map(u => <UserRow key={u.id} user={u} />)}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending Coach Requests */}
          <div className="table-card">
            <h3>⏳ Pending Coach Requests</h3>
            {(tables.pendingCoaches || []).length === 0 ? (
              <p className="empty-table">No pending coach requests.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Resume</th>
                    <th>Status</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.pendingCoaches.map(c => <CoachRow key={c.id} coach={c} />)}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Coaches */}
          <div className="table-card full-width">
            <h3>🎓 Recent Coaches</h3>
            {(tables.recentCoaches || []).length === 0 ? (
              <p className="empty-table">No coaches registered yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Resume</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.recentCoaches.map(c => <CoachRow key={c.id} coach={c} />)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
