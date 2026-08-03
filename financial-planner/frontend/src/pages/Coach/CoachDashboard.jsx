import { useState, useEffect } from 'react';
import { coachApi, chatApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ChatBox from '../../components/Chat/ChatBox';
import './CoachDashboard.css';

export default function CoachDashboard() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    fetchUsers();

    // Load initial unread counts grouped by sender
    chatApi.getUnreadCount()
      .then(res => {
        const bySender = res.data.bySender || {};
        // Convert string keys back to numbers
        const parsed = {};
        Object.entries(bySender).forEach(([k, v]) => { parsed[Number(k)] = v; });
        setUnreadCounts(parsed);
      })
      .catch(console.error);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await coachApi.getAssignedUsers();
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned users.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (u) => {
    setSelectedChatUser(u);
    setUnreadCounts(prev => ({ ...prev, [u.id]: 0 }));
    chatApi.markAsRead(u.id).catch(console.error);
  };

  // Called when ChatBox receives a message that belongs to another user's conversation
  const handleBackgroundMessage = (msg) => {
    setUnreadCounts(prev => ({
      ...prev,
      [msg.senderId]: (prev[msg.senderId] || 0) + 1
    }));
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="coach-layout">
      <header className="coach-header">
        <div className="header-left">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1>Coach Dashboard</h1>
        </div>
        <div className="header-right">
          <div className="user-profile-widget">
            <div className="user-info">
              <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
              <span className="user-name">{user?.name}</span>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="coach-main">
        <div className="coach-welcome">
          <h2>Welcome, Coach {user?.name}</h2>
          <p>Here are the users currently assigned to you. Review their financial summaries to provide the best advice.</p>
        </div>

        {error && <div className="coach-error">{error}</div>}

        <div className="coach-table-container">
          {loading ? (
            <div className="coach-loading">Loading assigned users...</div>
          ) : users.length === 0 ? (
            <div className="coach-empty">
              <span className="empty-icon">👥</span>
              <h3>No Users Assigned</h3>
              <p>You currently do not have any users assigned to you.</p>
            </div>
          ) : (
            <table className="coach-table">
              <thead>
                <tr>
                  <th>User Info</th>
                  <th>Contact</th>
                  <th>Financial Summary</th>
                  <th>Goals</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-meta">
                        <span className="user-name-bold">{u.name}</span>
                        <span className="user-date">Joined: {formatDate(u.registrationDate)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <span title="Email">✉️ {u.email}</span>
                        {u.phone && <span title="Phone">📞 {u.phone}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="financial-grid">
                        <div className="fin-item">
                          <span className="fin-label">Income</span>
                          <span className="fin-val text-success">{formatCurrency(u.totalIncome)}</span>
                        </div>
                        <div className="fin-item">
                          <span className="fin-label">Expenses</span>
                          <span className="fin-val text-danger">{formatCurrency(u.totalExpenses)}</span>
                        </div>
                        <div className="fin-item">
                          <span className="fin-label">Assets</span>
                          <span className="fin-val text-info">{formatCurrency(u.totalAssets)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="goal-badge">
                        <span>🎯 {u.goalCount ?? u.totalGoals ?? 0}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="chat-action-btn"
                        onClick={() => handleOpenChat(u)}
                        style={{
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          position: 'relative'
                        }}
                      >
                        💬 Chat
                        {(unreadCounts[u.id] > 0) && (
                          <span style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            minWidth: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            padding: '0 4px'
                          }}>
                            {unreadCounts[u.id] > 99 ? '99+' : unreadCounts[u.id]}
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Chat Modal Overlay */}
      {selectedChatUser && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem'
          }}
          onClick={() => setSelectedChatUser(null)}
        >
          <div style={{ width: '100%', maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <ChatBox
              partner={{ id: selectedChatUser.id, name: selectedChatUser.name, role: 'ROLE_USER' }}
              onClose={() => setSelectedChatUser(null)}
              onNewMessage={handleBackgroundMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
