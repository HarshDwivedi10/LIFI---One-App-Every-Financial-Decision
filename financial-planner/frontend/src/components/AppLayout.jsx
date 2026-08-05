import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { chatApi } from '../services/api';
import ChatBox from './Chat/ChatBox';

import logo from '../assets/logo.png';

import './AppLayout.css';
const NAV_ITEMS = [{ path: '/', label: 'Home', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>) },{ path: '/expense-management', label: 'Expense Management', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>) },{ path: '/fund-management', label: 'Fund Management', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>) },{ path: '/retirement-planner', label: 'Retirement Planning', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 7 3 5-3 5"/><path d="m19 7-3 5 3 5"/></svg>) },{ path: '/goal-management', label: 'Goal Management', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>) },{ path: '/expert-connect', label: 'Financial Expert', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [userCoachInfo, setUserCoachInfo] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { notifications } = useNotifications();
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  useEffect(() => {
    if (user?.role === 'ROLE_USER') {
      // Fetch assigned coach info
      chatApi.getMyCoach()
        .then(res => {
          if (res.data && res.data.id) {
            setUserCoachInfo({ coachId: res.data.id, coachName: res.data.name, hasCoach: true });
          } else if (user?.assignedCoachName) {
            setUserCoachInfo({ hasCoach: true, coachId: user.assignedCoachId, coachName: user.assignedCoachName });
          }
        })
        .catch(() => {
          if (user?.assignedCoachName) {
            setUserCoachInfo({ hasCoach: true, coachId: user.assignedCoachId, coachName: user.assignedCoachName });
          }
        });

      // Load initial unread count
      chatApi.getUnreadCount()
        .then(res => setUnreadCount(res.data.unreadCount || 0))
        .catch(console.error);
    }
  }, [user]);

  const handleOpenChat = () => {
    setShowChatModal(true);
    setUnreadCount(0);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
  };

  // Called by ChatBox when a message from a different sender arrives while chat is open
  const handleBackgroundMessage = () => {
    setUnreadCount(prev => prev + 1);
  };

  const coachPartner = userCoachInfo
    ? { id: userCoachInfo.coachId || user?.assignedCoachId, name: userCoachInfo.coachName || user?.assignedCoachName, role: 'ROLE_COACH' }
    : null;

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <div className="topbar-logo">
  <img
    src={logo}
    alt="LiFi Logo"
    className="logo-image"
  />
</div>

<nav className="topbar-nav">
  {NAV_ITEMS.map((item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `nav-link ${isActive ? "active" : ""}`
      }
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  ))}
</nav>

        

        <div className="topbar-user">
          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: 'none',
                color: 'var(--info, #3b82f6)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginRight: '0.5rem',
                position: 'relative'
              }}
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {notifications && notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  width: '14px',
                  height: '14px',
                  background: 'var(--danger, #ef4444)',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {notifications.length}
                </span>
              )}
            </button>
            
            {showNotificationsMenu && (
              <div style={{
                position: 'absolute',
                top: '120%',
                right: '0',
                width: '320px',
                background: 'var(--bg-card, #1e1e2d)',
                border: '1px solid var(--border-subtle, #2b2b3a)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                zIndex: 100,
                padding: '0.5rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '0.5rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-subtle, #2b2b3a)', marginBottom: '0.5rem' }}>
                  Notifications
                </div>
                {(!notifications || notifications.length === 0) ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.85rem' }}>
                    No notifications
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.map((n, i) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        gap: '0.5rem',
                        padding: '0.75rem',
                        background: 'var(--bg-input, #252536)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          marginTop: '4px',
                          flexShrink: 0,
                          background: n.type === 'danger' ? 'var(--danger, #ef4444)' : 
                                      n.type === 'warning' ? 'var(--warning, #f59e0b)' : 
                                      n.type === 'success' ? 'var(--success, #10b981)' : 'var(--info, #3b82f6)'
                        }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-secondary, #d1d5db)' }}>{n.text}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '4px' }}>{n.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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

      <main className="app-main-content">
        <Outlet />
      </main>

      {/* Floating Chat Button */}
      {userCoachInfo?.hasCoach && (
        <button
          className="floating-chat-btn"
          onClick={handleOpenChat}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            transition: 'transform 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              minWidth: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              border: '2px solid #0F1015'
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat with Coach Modal Overlay */}
      {showChatModal && coachPartner && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem'
          }}
          onClick={handleCloseChat}
        >
          <div style={{ width: '100%', maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <ChatBox
              partner={coachPartner}
              onClose={handleCloseChat}
              onNewMessage={handleBackgroundMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
