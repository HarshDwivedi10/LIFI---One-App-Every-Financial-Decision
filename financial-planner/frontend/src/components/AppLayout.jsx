import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import api, { chatApi } from '../services/api';
import ChatBox from './Chat/ChatBox';
import GoalCompletionNotifier from './GoalCompletionNotifier';

import './AppLayout.css';

const NAV_ITEMS = [
  { 
    path: '/', 
    label: 'Home', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>) 
  },
  { 
    path: '/expense-management', 
    label: 'Your Monthly Savings', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>) 
  },
  { 
    path: '/fund-management', 
    label: 'Goal Management', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>) 
  },
  { 
    path: '/goal-management', 
    label: 'Create a Goal', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>) 
  },
  { 
    path: '/fund-transfer', 
    label: 'Fund Transfer', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/></svg>) 
  },
  { 
    path: '/expert-connect', 
    label: 'Hire a Finance Expert', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1 0 7.75"/></svg>) 
  },
  { 
    path: '/retirement-planner', 
    label: 'Retirement Planning', 
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>) 
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [userCoachInfo, setUserCoachInfo] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [hasRetirementPlan, setHasRetirementPlan] = useState(false);
  const [unallocatedBalance, setUnallocatedBalance] = useState(0);

  useEffect(() => {
    if (user?.role === 'ROLE_USER') {
      const checkRetirement = () => {
        api.get('/retirement/plan').then(res => {
           if (res.data && res.data.id) {
              setHasRetirementPlan(true);
           }
        }).catch(() => {});
      };
      checkRetirement();
      window.addEventListener('retirementPlanUpdated', checkRetirement);

      // Fetch assets to check for negative unallocated balance
      api.get('/assets').then(res => {
        if (res.data && Array.isArray(res.data)) {
          const unallocated = res.data.find(a => a.assetType === 'UNALLOCATED');
          if (unallocated) {
            setUnallocatedBalance(unallocated.currentValue || 0);
          }
        }
      }).catch(() => {});

      // Fetch assigned coach info
      const checkCoach = () => {
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
      };
      checkCoach();
      window.addEventListener('coachHired', checkCoach);

      // Load initial unread count
      chatApi.getUnreadCount()
        .then(res => setUnreadCount(res.data.unreadCount || 0))
        .catch(console.error);
        
      return () => {
        window.removeEventListener('retirementPlanUpdated', checkRetirement);
        window.removeEventListener('coachHired', checkCoach);
      };
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
      {/* Left Sidebar Navigation */}
      <aside className="app-sidebar">
        <Link to="/" className="sidebar-brand" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0', marginBottom: '32px', width: '100%' }}>
          <img 
            src="/lifi-logo.png" 
            alt="LI.FI - One App Every Financial Decision" 
            style={{ 
              width: '100%', 
              maxWidth: '240px', 
              height: 'auto', 
              maxHeight: '190px', 
              objectFit: 'contain', 
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
              transform: 'scale(2.0)',
              transformOrigin: 'center center'
            }} 
          />
        </Link>

        {/* Navigation links */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(item => {
             if (item.path === '/retirement-planner') return hasRetirementPlan;
             return true;
          }).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">
                {item.path === '/retirement-planner' 
                   ? 'Your Retirement' 
                   : (item.path === '/expert-connect' && userCoachInfo?.hasCoach) 
                     ? 'Your financial Expert' 
                     : item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Bottom Footer: Notifications & User Profile */}
        <div className="sidebar-footer">
          <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>

          <div className="user-profile-widget" style={{ width: '100%', justifyContent: 'space-between', padding: '6px 12px', borderRadius: '12px' }} title={user?.name || "User Profile"}>
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="user-avatar" style={{ width: '32px', height: '32px' }}>{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{user?.name || 'User'}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout" style={{ background: 'transparent', width: '32px', height: '32px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <div className="app-main-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
        {unallocatedBalance < 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', borderBottom: '1px solid rgba(239, 68, 68, 0.4)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div>
                <span style={{ color: '#FCA5A5', fontWeight: 600, fontSize: '15px', display: 'block', marginBottom: '4px' }}>
                  ⚠️ Critical Alert: Your Unallocated Savings is in debt (₹{new Intl.NumberFormat('en-IN').format(unallocatedBalance)})
                </span>
                <span style={{ color: '#FECACA', fontSize: '13px' }}>
                  Please go to Fund Transfer and move money from a Goal to resolve this negative balance.
                </span>
              </div>
            </div>
            <Link to="/fund-transfer" style={{ background: '#EF4444', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}>
              Go to Fund Transfer
            </Link>
          </div>
        )}
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>

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

      {/* Floating Facebook-Style Chat Overlay */}
      {showChatModal && coachPartner && (
        <ChatBox
          partner={coachPartner}
          isHired={true}
          onClose={handleCloseChat}
          onNewMessage={handleBackgroundMessage}
        />
      )}

      {/* Global Notifier for Reached Goals */}
      <GoalCompletionNotifier />
    </div>
  );
}
