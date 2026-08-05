import { useState, useEffect } from 'react';
import { coachApi, chatApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ChatBox from '../../components/Chat/ChatBox';

// Import real user website page views
import HomePage from '../Home/HomePage';
import ExpenseManagementPage from '../ExpenseManagement/ExpenseManagementPage';
import FundManagementPage from '../FundManagement/FundManagementPage';
import GoalManagementPage from '../GoalManagement/GoalManagementPage';
import RetirementPlannerPage from '../RetirementPlanner/RetirementPlannerPage';

import toast from 'react-hot-toast';
import './CoachDashboard.css';

export default function CoachDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('website'); // 'website' | 'profile' | 'users'
  const [websiteRoute, setWebsiteRoute] = useState('home'); // 'home' | 'expenses' | 'funds' | 'goals' | 'retirement'
  
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Suggestion Modal state
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionCategory, setSuggestionCategory] = useState('General Advice');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);

  // Profile Editor state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    title: 'Financial Planning Coach',
    location: 'Mumbai, India',
    yearsExperience: '10+ Years',
    rating: 4.9,
    clientCount: '120+ Clients',
    consultationFee: 1999,
    aboutMe: '',
    expertise: '',
    phone: '',
    linkedIn: '',
    professionalSummary: '',
    experienceDetails: '',
    educationDetails: '',
    profilePictureBase64: '',
    resumeBase64: ''
  });

  useEffect(() => {
    if (activeTab === 'website' && selectedUser) {
      localStorage.setItem('targetUserId', selectedUser.id.toString());
    } else {
      localStorage.removeItem('targetUserId');
    }
    return () => {
      localStorage.removeItem('targetUserId');
    };
  }, [activeTab, selectedUser?.id]);

  useEffect(() => {
    fetchUsers();
    fetchProfile();

    chatApi.getUnreadCount()
      .then(res => {
        const bySender = res.data.bySender || {};
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
      setUsers(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedUser(res.data[0]);
        setActiveTab('website');
      } else {
        setActiveTab('profile');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned users.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const res = await coachApi.getProfile();
      if (res.data) {
        setProfileForm({
          name: res.data.name || user?.name || '',
          title: res.data.title || 'Financial Planning Coach',
          location: res.data.location || 'Mumbai, India',
          yearsExperience: res.data.yearsExperience || '10+ Years',
          rating: res.data.rating || 4.9,
          clientCount: res.data.clientCount || '120+ Clients',
          consultationFee: res.data.consultationFee || 1999,
          aboutMe: res.data.aboutMe || '',
          expertise: res.data.expertise || 'Retirement Planning, Investment Strategy, Tax Planning, Goal Based Financial Planning, Wealth Management',
          phone: res.data.phone || '',
          linkedIn: res.data.linkedIn || '',
          professionalSummary: res.data.professionalSummary || '',
          experienceDetails: res.data.experienceDetails || '',
          educationDetails: res.data.educationDetails || '',
          profilePictureBase64: res.data.profilePictureBase64 || '',
          resumeBase64: res.data.resumeBase64 || ''
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Profile image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm(prev => ({ ...prev, profilePictureBase64: reader.result }));
        toast.success('Profile picture loaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResumeUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Resume PDF size should be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm(prev => ({ ...prev, resumeBase64: reader.result }));
        toast.success('Resume file loaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      await coachApi.updateProfile(profileForm);
      toast.success('Coach profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendSuggestion = async (e) => {
    e.preventDefault();
    if (!selectedUser || !suggestionText.trim()) return;

    try {
      setSendingSuggestion(true);
      await coachApi.postSuggestion(selectedUser.id, suggestionText, suggestionCategory);
      toast.success(`💡 Suggestion published to ${selectedUser.name}'s page!`);
      setSuggestionText('');
      setShowSuggestionModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish suggestion.');
    } finally {
      setSendingSuggestion(false);
    }
  };

  const handleOpenChat = (u) => {
    setSelectedChatUser(u);
    setUnreadCounts(prev => ({ ...prev, [u.id]: 0 }));
    chatApi.markAsRead(u.id).catch(console.error);
  };

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
      {/* Clean Top Header Navbar */}
      <header className="coach-header">
        <div className="header-left">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1>Coach Portal</h1>
        </div>

        {/* Clean Navbar Tabs: Direct User Names (Hired Users) + My Profile */}
        <div className="coach-nav-tabs">
          {users.length === 0 ? (
            <span className="no-users-pill">👥 No Hired Users Yet</span>
          ) : (
            users.map(u => (
              <button 
                key={u.id}
                className={`coach-tab-btn user-pill ${selectedUser?.id === u.id && activeTab === 'website' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedUser(u);
                  setActiveTab('website');
                }}
              >
                <span>👤 {u.name}</span>
                <span className={`perm-mini-badge ${u.coachPermission === 'READ_WRITE' ? 'rw' : 'ro'}`}>
                  {u.coachPermission === 'READ_WRITE' ? '✏️ Edit' : '👁️ Read'}
                </span>
              </button>
            ))
          )}

          <button 
            className={`coach-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            📇 My Profile & Card Editor
          </button>
        </div>

        {/* Right Side: Coach Profile Widget & Logout */}
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
        {/* TAB 1: ACTUAL USER WEBSITE PORTAL VIEWER */}
        {activeTab === 'website' && selectedUser && (
          <div className="actual-user-website-container">
            {/* Sticky Top Bar for Coach navigating user website */}
            <div className="user-website-topbar">
              <div className="topbar-left">
                <span className="user-avatar-sm">{selectedUser.name?.charAt(0).toUpperCase()}</span>
                <div className="user-title-group">
                  <h3>Viewing {selectedUser.name}'s Website</h3>
                  <span className="user-sub">✉️ {selectedUser.email}</span>
                </div>
                <span className={`perm-tag-lg ${selectedUser.coachPermission === 'READ_WRITE' ? 'rw' : 'ro'}`}>
                  {selectedUser.coachPermission === 'READ_WRITE' ? '✏️ Read & Edit Access' : '👁️ Read-Only Mode'}
                </span>
              </div>

              {/* Sub Route Navigation */}
              <div className="website-route-nav">
                <button 
                  className={`route-btn ${websiteRoute === 'home' ? 'active' : ''}`}
                  onClick={() => setWebsiteRoute('home')}
                >
                  🏠 Home
                </button>
                <button 
                  className={`route-btn ${websiteRoute === 'expenses' ? 'active' : ''}`}
                  onClick={() => setWebsiteRoute('expenses')}
                >
                  💳 Expenses
                </button>
                <button 
                  className={`route-btn ${websiteRoute === 'funds' ? 'active' : ''}`}
                  onClick={() => setWebsiteRoute('funds')}
                >
                  📊 Funds
                </button>
                <button 
                  className={`route-btn ${websiteRoute === 'goals' ? 'active' : ''}`}
                  onClick={() => setWebsiteRoute('goals')}
                >
                  🎯 Goals
                </button>
                <button 
                  className={`route-btn ${websiteRoute === 'retirement' ? 'active' : ''}`}
                  onClick={() => setWebsiteRoute('retirement')}
                >
                  🏖️ Retirement
                </button>
              </div>

              <div className="topbar-right">
                <button className="post-sug-btn" onClick={() => setShowSuggestionModal(true)}>
                  💡 Post Suggestion
                </button>

                <button className="chat-action-btn" onClick={() => handleOpenChat(selectedUser)}>
                  💬 Chat
                  {(unreadCounts[selectedUser.id] > 0) && (
                    <span className="unread-badge">
                      {unreadCounts[selectedUser.id] > 99 ? '99+' : unreadCounts[selectedUser.id]}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Granted Permission Notice Banner */}
            <div className={`permission-notice-banner ${selectedUser.coachPermission === 'READ_WRITE' ? 'rw' : 'ro'}`}>
              {selectedUser.coachPermission === 'READ_WRITE'
                ? `✏️ READ & EDIT PERMISSION GRANTED: You are viewing ${selectedUser.name}'s website. You can edit fields directly.`
                : `👁️ READ-ONLY PERMISSION GRANTED: You are viewing ${selectedUser.name}'s website in Read-Only mode. Edits are disabled.`}
            </div>

            {/* Actual User Website Page Render */}
            <div key={`user-view-${selectedUser.id}-${websiteRoute}`} className={`user-page-wrapper ${selectedUser.coachPermission === 'READ_ONLY' ? 'read-only-overlay' : ''}`}>
              {websiteRoute === 'home' && <HomePage targetUser={selectedUser} />}
              {websiteRoute === 'expenses' && <ExpenseManagementPage targetUser={selectedUser} />}
              {websiteRoute === 'funds' && <FundManagementPage targetUser={selectedUser} />}
              {websiteRoute === 'goals' && <GoalManagementPage targetUser={selectedUser} />}
              {websiteRoute === 'retirement' && <RetirementPlannerPage targetUser={selectedUser} />}
            </div>
          </div>
        )}

        {/* TAB 2: COACH PROFILE EDITOR */}
        {activeTab === 'profile' && (
          <div className="coach-profile-editor">
            <div className="coach-welcome">
              <h2>Edit Public Coach Card & Resume</h2>
              <p>Customize how your card, experience, bio, and resume are displayed to users on the Financial Expert page.</p>
            </div>

            {profileLoading ? (
              <div className="coach-loading">Loading your profile data...</div>
            ) : (
              <form onSubmit={handleSaveProfile} className="profile-form-grid">
                
                {/* Profile Avatar & Basic Info */}
                <div className="profile-section-card">
                  <h3>🖼️ Profile Picture & Basic Info</h3>
                  
                  <div className="avatar-upload-preview">
                    <div className="avatar-circle">
                      {profileForm.profilePictureBase64 ? (
                        <img src={profileForm.profilePictureBase64} alt="Avatar" />
                      ) : (
                        <span>{profileForm.name?.charAt(0).toUpperCase() || 'C'}</span>
                      )}
                    </div>
                    <div className="upload-controls">
                      <label className="upload-btn">
                        Upload Profile Photo
                        <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                      </label>
                      <span className="upload-hint">Recommended size: Square JPG/PNG (Max 5MB)</span>
                    </div>
                  </div>

                  <div className="form-row dual">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input 
                        type="text" 
                        value={profileForm.name} 
                        onChange={e => handleProfileChange('name', e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Designation / Title</label>
                      <input 
                        type="text" 
                        value={profileForm.title} 
                        onChange={e => handleProfileChange('title', e.target.value)} 
                        placeholder="e.g. Financial Planning Coach"
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row dual">
                    <div className="form-group">
                      <label>Location</label>
                      <input 
                        type="text" 
                        value={profileForm.location} 
                        onChange={e => handleProfileChange('location', e.target.value)} 
                        placeholder="e.g. Mumbai, India"
                      />
                    </div>
                    <div className="form-group">
                      <label>Consultation Fee (₹ / session)</label>
                      <input 
                        type="number" 
                        value={profileForm.consultationFee} 
                        onChange={e => handleProfileChange('consultationFee', parseFloat(e.target.value) || 0)} 
                        placeholder="e.g. 1999"
                      />
                    </div>
                  </div>

                  <div className="form-row dual">
                    <div className="form-group">
                      <label>Years of Experience</label>
                      <input 
                        type="text" 
                        value={profileForm.yearsExperience} 
                        onChange={e => handleProfileChange('yearsExperience', e.target.value)} 
                        placeholder="e.g. 10+ Years"
                      />
                    </div>
                    <div className="form-group">
                      <label>Clients Served / Rating Badge</label>
                      <input 
                        type="text" 
                        value={profileForm.clientCount} 
                        onChange={e => handleProfileChange('clientCount', e.target.value)} 
                        placeholder="e.g. 120+ Clients"
                      />
                    </div>
                  </div>
                </div>

                {/* About & Expertise */}
                <div className="profile-section-card">
                  <h3>🎯 About Coach & Expertise Areas</h3>
                  
                  <div className="form-group">
                    <label>About Coach (Short Bio)</label>
                    <textarea 
                      rows="4" 
                      value={profileForm.aboutMe} 
                      onChange={e => handleProfileChange('aboutMe', e.target.value)} 
                      placeholder="Write a concise overview of your background..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Expertise Areas (Comma separated)</label>
                    <input 
                      type="text" 
                      value={profileForm.expertise} 
                      onChange={e => handleProfileChange('expertise', e.target.value)} 
                      placeholder="Retirement Planning, Investment Strategy, Tax Planning"
                    />
                  </div>
                </div>

                {/* Resume / CV Section */}
                <div className="profile-section-card">
                  <h3>📄 Resume / CV Details & PDF Document</h3>

                  <div className="form-row dual">
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input 
                        type="text" 
                        value={profileForm.phone} 
                        onChange={e => handleProfileChange('phone', e.target.value)} 
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="form-group">
                      <label>LinkedIn URL</label>
                      <input 
                        type="text" 
                        value={profileForm.linkedIn} 
                        onChange={e => handleProfileChange('linkedIn', e.target.value)} 
                        placeholder="linkedin.com/in/rohitsharma"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Professional Summary</label>
                    <textarea 
                      rows="3" 
                      value={profileForm.professionalSummary} 
                      onChange={e => handleProfileChange('professionalSummary', e.target.value)} 
                      placeholder="Detailed professional summary..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Experience Details (Timeline)</label>
                    <textarea 
                      rows="4" 
                      value={profileForm.experienceDetails} 
                      onChange={e => handleProfileChange('experienceDetails', e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Education Details (Timeline)</label>
                    <textarea 
                      rows="3" 
                      value={profileForm.educationDetails} 
                      onChange={e => handleProfileChange('educationDetails', e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Downloadable Resume File (PDF)</label>
                    <div className="upload-controls">
                      <label className="upload-btn alt">
                        📁 {profileForm.resumeBase64 ? 'Replace PDF Resume' : 'Upload PDF Resume'}
                        <input type="file" accept="application/pdf" onChange={handleResumeUpload} hidden />
                      </label>
                      {profileForm.resumeBase64 && (
                        <span className="file-status">✓ PDF Resume Attached</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="profile-save-bar">
                  <button type="submit" className="save-profile-btn" disabled={profileSaving}>
                    {profileSaving ? 'Saving Changes...' : '💾 Save Coach Profile & Live Card'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Suggestion Posting Modal */}
      {showSuggestionModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="suggestion-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💡 Publish Suggestion to {selectedUser.name}</h3>
              <button className="modal-close" onClick={() => setShowSuggestionModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSendSuggestion} className="modal-body">
              <div className="form-group">
                <label>Category / Topic</label>
                <select value={suggestionCategory} onChange={e => setSuggestionCategory(e.target.value)}>
                  <option value="General Advice">💡 General Advice</option>
                  <option value="Expense Optimization">💰 Expense Optimization</option>
                  <option value="Goal Management">🎯 Goal Management</option>
                  <option value="Investment Strategy">📈 Investment Strategy</option>
                  <option value="Retirement Planning">🏖️ Retirement Planning</option>
                  <option value="Tax Minimization">🧾 Tax Minimization</option>
                </select>
              </div>

              <div className="form-group">
                <label>Recommendation Message</label>
                <textarea 
                  rows="5"
                  placeholder={`Write personalized financial advice for ${selectedUser.name}...`}
                  value={suggestionText}
                  onChange={e => setSuggestionText(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowSuggestionModal(false)}>Cancel</button>
                <button type="submit" className="submit-sug-btn" disabled={sendingSuggestion || !suggestionText.trim()}>
                  {sendingSuggestion ? 'Publishing...' : `🚀 Publish to ${selectedUser.name}'s Page`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
