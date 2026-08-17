import { useState, useEffect } from 'react';
import { userCoachApi } from '../../services/api';
import ChatBox from '../../components/Chat/ChatBox';
import HiredCoachView from './HiredCoachView';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { initiateRazorpayCheckout } from '../../services/RazorpayService';
import './ExpertConnectPage.css';

export default function ExpertConnectPage() {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hiring, setHiring] = useState(false);
  const [activeChatCoach, setActiveChatCoach] = useState(null);

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      const res = await userCoachApi.getActiveCoaches();
      if (res.data) {
        setCoaches(res.data);
      } else {
        setCoaches([]);
      }
    } catch (err) {
      console.error('Failed to load active coaches from server:', err);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  const hiredCoach = coaches.find(c => c.hiredByCurrentUser);
  const displayedCoaches = coaches;
  const currentCoach = displayedCoaches[currentIndex] || displayedCoaches[0];

  const handlePrev = () => {
    if (displayedCoaches.length === 0) return;
    setCurrentIndex(prev => (prev === 0 ? displayedCoaches.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (displayedCoaches.length === 0) return;
    setCurrentIndex(prev => (prev === displayedCoaches.length - 1 ? 0 : prev + 1));
  };

  const handleHireCoach = async (coachToHire) => {
    // Ignore React synthetic click events passed as first param
    const isEvent = coachToHire && (coachToHire.nativeEvent || coachToHire.preventDefault || coachToHire.target);
    const targetCoach = (!isEvent && coachToHire && coachToHire.name) ? coachToHire : currentCoach;

    if (!targetCoach) return;

    const coachId = targetCoach.userId || targetCoach.id || targetCoach.profileId;
    if (!coachId) {
      toast.error('Unable to resolve coach identifier.');
      return;
    }

    initiateRazorpayCheckout({
      coach: { id: coachId, name: targetCoach.name, consultationFee: targetCoach.consultationFee },
      amount: targetCoach.consultationFee || 1999,
      currentUser: user,
      onSuccess: () => {
        fetchCoaches();
        window.dispatchEvent(new Event('coachHired'));
      }
    });
  };

  const handleDownloadCV = () => {
    if (!currentCoach) return;

    if (currentCoach.resumeBase64 && currentCoach.resumeBase64.trim().length > 0) {
      let dataUrl = currentCoach.resumeBase64;
      if (!dataUrl.startsWith('data:')) {
        dataUrl = `data:application/pdf;base64,${dataUrl}`;
      }
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${currentCoach.name.replace(/\s+/g, '_')}_Uploaded_CV.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded ${currentCoach.name}'s uploaded CV file!`);
    } else {
      toast.error(`⚠️ No CV document uploaded by Coach ${currentCoach.name} yet.`);
    }
  };

  const getExpertiseList = (expStr) => {
    if (!expStr) return ['Retirement Planning', 'Investment Strategy', 'Tax Planning', 'Goal Based Financial Planning', 'Wealth Management'];
    return expStr.split(',').map(s => s.trim()).filter(Boolean);
  };

  const renderTimelineText = (textStr) => {
    if (!textStr) return null;
    return textStr.split('\n\n').map((block, idx) => {
      const lines = block.split('\n');
      const header = lines[0];
      const details = lines.slice(1).join(' ');
      return (
        <div key={idx} className="timeline-item">
          <div className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-header">{header}</div>
            {details && <div className="timeline-desc">{details}</div>}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="expert-connect-page">
      {loading ? (
        <div className="expert-loading-state">
          <div className="spinner" />
          <p>Loading financial experts...</p>
        </div>
      ) : hiredCoach ? (
        <HiredCoachView coach={hiredCoach} onOpenChat={(c) => setActiveChatCoach(c)} />
      ) : (
        <>


          {displayedCoaches.length === 0 ? (
            <div className="expert-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3>No Approved Coaches Available</h3>
              <p>There are currently no approved financial coaches available on the platform. Once a coach registers and is approved by an administrator, their profile will appear here.</p>
            </div>
          ) : (
            <div className="carousel-wrapper">
          {/* Left Arrow Button */}
          <button 
            className="carousel-arrow left-arrow"
            onClick={handlePrev}
            title="Previous Coach"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* Main Card View */}
          <div className="coach-display-card">
                     {/* Unified Single Card UI */}
            <div className="coach-single-card" style={{ padding: '32px' }}>
              
              {/* Top Row: Avatar + Identity + Contacts */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px' }}>
                <div className="profile-avatar-wrapper" style={{ width: '100px', height: '100px', flexShrink: 0 }}>
                  {currentCoach.profilePictureBase64 ? (
                    <img src={currentCoach.profilePictureBase64} alt={currentCoach.name} className="profile-avatar-img" />
                  ) : (
                    <div className="profile-avatar-fallback">
                      <span className="avatar-initial" style={{ fontSize: '32px' }}>{currentCoach.name?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <h2 className="coach-name" style={{ fontSize: '28px', marginBottom: '4px' }}>{currentCoach.name}</h2>
                  <div className="coach-designation" style={{ color: '#818CF8', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{currentCoach.title || 'Financial Planning Coach'}</div>
                  <div className="coach-location" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9CA3AF', fontSize: '14px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {currentCoach.location || 'Mumbai, India'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#9CA3AF', minWidth: '220px' }}>
                  {currentCoach.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>{currentCoach.email}</div>}
                  {currentCoach.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{currentCoach.phone}</div>}
                  {currentCoach.linkedIn && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>{currentCoach.linkedIn}</div>}
                </div>
              </div>

              <div style={{ color: '#D1D5DB', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
                {currentCoach.professionalSummary || currentCoach.aboutMe}
              </div>

              {/* Badges Row */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: '#232533', padding: '10px', borderRadius: '10px', color: '#fff' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{currentCoach.yearsExperience || '10+ Years'}</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Experience</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: '#232533', padding: '10px', borderRadius: '10px', color: '#f59e0b' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{currentCoach.rating || 4.9}/5</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF' }}>({currentCoach.clientCount || '120+ Clients'})</div>
                  </div>
                </div>
              </div>

              {/* Expertise List */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818CF8', fontWeight: 700, marginBottom: '16px' }}>Expertise</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {getExpertiseList(currentCoach.expertise).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', fontSize: '13px', color: '#D1D5DB' }}>
                      <span style={{ color: '#818CF8' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Experience Timeline */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818CF8', fontWeight: 700, marginBottom: '16px' }}>Experience</h3>
                <div className="timeline-container">
                  {renderTimelineText(currentCoach.experienceDetails)}
                </div>
              </div>

              {/* Education Timeline */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818CF8', fontWeight: 700, marginBottom: '16px' }}>Education</h3>
                <div className="timeline-container">
                  {renderTimelineText(currentCoach.educationDetails)}
                </div>
              </div>

              <button 
                onClick={handleDownloadCV}
                style={{ width: '100%', padding: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#D1D5DB', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download CV (PDF)
              </button>
            </div>

            {/* Bottom Footer Bar: Pricing & Hire Action */}
            <div className="coach-card-footer">
              <div className="footer-pricing">
                <span className="fee-label">Consultation Fee</span>
                <span className="fee-amount">₹ {currentCoach.consultationFee?.toLocaleString() || '1,999'} / session</span>
              </div>

              <div className="footer-security">
                <div className="shield-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                </div>
                <div className="security-text">
                  <span className="sec-title">Secure Payment</span>
                  <span className="sec-sub">100% Safe & Secure</span>
                </div>
              </div>

              <div className="footer-action" style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="free-chat-btn"
                  onClick={() => setActiveChatCoach(currentCoach)}
                  style={{ background: '#6366F1', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {currentCoach.hiredByCurrentUser ? 'Chat with Coach' : 'Free 10-Min Chat'}
                </button>

                {!currentCoach.hiredByCurrentUser && (
                  <button 
                    className="hire-btn"
                    onClick={() => handleHireCoach(currentCoach)}
                    disabled={hiring}
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    {hiring ? 'Processing...' : 'Hire Coach & Pay'}
                  </button>
                )}
              </div>
            </div>

            <div className="footer-microcopy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              You will be redirected to a secure payment gateway to complete your payment.
            </div>

          </div>

          {/* Right Arrow Button */}
          <button 
            className="carousel-arrow right-arrow"
            onClick={handleNext}
            title="Next Coach"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
          )}
        </>
      )}

      {/* Facebook-Style Bottom-Left Floating Chat Overlay (No Popup Modal) */}
      {activeChatCoach && (
        <ChatBox
          partner={{
            id: activeChatCoach.userId,
            name: activeChatCoach.name,
            role: 'ROLE_COACH',
            hiredByCurrentUser: activeChatCoach.hiredByCurrentUser
          }}
          isHired={activeChatCoach.hiredByCurrentUser}
          onClose={() => setActiveChatCoach(null)}
          onHireClick={handleHireCoach}
        />
      )}
    </div>
  );
}
