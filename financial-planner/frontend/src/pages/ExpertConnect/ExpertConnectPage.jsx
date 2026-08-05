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
          {/* Top Header */}
          <div className="expert-header">
            <h1 className="expert-title">Financial Expert Connect</h1>
            <p className="expert-subtitle">
              Browse expert coaches, review their experience and resume, and hire the right coach for your financial journey.
            </p>
          </div>

          {displayedCoaches.length === 0 ? (
            <div className="expert-empty-state">
              <span>👥</span>
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
            
            {/* Split Grid: Left Profile Card | Right Resume/CV Card */}
            <div className="coach-card-grid">
              
              {/* LEFT SIDE: Coach Profile Details */}
              <div className="coach-profile-side">
                
                {/* Avatar & Header Info */}
                <div className="profile-header-group">
                  <div className="profile-avatar-wrapper">
                    {currentCoach.profilePictureBase64 ? (
                      <img src={currentCoach.profilePictureBase64} alt={currentCoach.name} className="profile-avatar-img" />
                    ) : (
                      <div className="profile-avatar-fallback">
                        <span className="avatar-initial">{currentCoach.name?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div className="profile-identity">
                    <h2 className="coach-name">{currentCoach.name}</h2>
                    <div className="coach-designation">{currentCoach.title || 'Financial Planning Coach'}</div>
                    <div className="coach-location">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {currentCoach.location || 'Mumbai, India'}
                    </div>
                  </div>
                </div>

                {/* Badges Row */}
                <div className="coach-badges-row">
                  <div className="stat-pill exp-pill">
                    <span className="pill-icon">💼</span>
                    <span className="pill-text">{currentCoach.yearsExperience || '10+ Years'}</span>
                    <span className="pill-sub">Experience</span>
                  </div>
                  <div className="stat-pill rating-pill">
                    <span className="pill-icon">⭐</span>
                    <span className="pill-text">{currentCoach.rating || 4.9}/5</span>
                    <span className="pill-sub">({currentCoach.clientCount || '120+ Clients'})</span>
                  </div>
                </div>

                {/* About Coach */}
                <div className="profile-section">
                  <h3 className="section-title">About Coach</h3>
                  <p className="about-text">{currentCoach.aboutMe}</p>
                </div>

                {/* Expertise List */}
                <div className="profile-section">
                  <h3 className="section-title">Expertise</h3>
                  <ul className="expertise-checklist">
                    {getExpertiseList(currentCoach.expertise).map((item, idx) => (
                      <li key={idx}>
                        <span className="check-icon">✓</span>
                        <span className="check-text">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Buttons: Chat & Download CV */}
                <div className="profile-action-stack">
                  <button 
                    className="free-chat-btn"
                    onClick={() => setActiveChatCoach(currentCoach)}
                  >
                    💬 {currentCoach.hiredByCurrentUser ? 'Chat with Coach' : 'Free 10-Min Chat'}
                  </button>

                  <button className="download-cv-btn" onClick={handleDownloadCV}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Uploaded CV (PDF)
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: Live Interactive Resume / CV Document */}
              <div className="coach-resume-side">
                
                {/* Resume Header Tag */}
                <div className="resume-topbar">
                  <div className="resume-tag">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Resume / CV
                  </div>
                  <div className="resume-page-num">{currentIndex + 1} / {displayedCoaches.length}</div>
                </div>

                {/* Resume Printable Container */}
                <div className="resume-sheet">
                  
                  {/* Resume Header */}
                  <div className="sheet-header">
                    <div className="sheet-title-group">
                      <h2 className="sheet-name">{currentCoach.name}</h2>
                      <div className="sheet-subtitle">{currentCoach.title || 'Financial Planning Coach'}</div>
                    </div>
                    <div className="sheet-contact-group">
                      {currentCoach.email && <div className="contact-line">✉️ {currentCoach.email}</div>}
                      {currentCoach.phone && <div className="contact-line">📞 {currentCoach.phone}</div>}
                      {currentCoach.location && <div className="contact-line">📍 {currentCoach.location}</div>}
                      {currentCoach.linkedIn && <div className="contact-line">🔗 {currentCoach.linkedIn}</div>}
                    </div>
                  </div>

                  <hr className="sheet-divider" />

                  {/* Professional Summary */}
                  <div className="sheet-section">
                    <h3 className="sheet-section-title">Professional Summary</h3>
                    <p className="sheet-summary-text">
                      {currentCoach.professionalSummary || currentCoach.aboutMe}
                    </p>
                  </div>

                  {/* Experience Timeline */}
                  <div className="sheet-section">
                    <h3 className="sheet-section-title">Experience</h3>
                    <div className="timeline-container">
                      {renderTimelineText(currentCoach.experienceDetails)}
                    </div>
                  </div>

                  {/* Education Timeline */}
                  <div className="sheet-section">
                    <h3 className="sheet-section-title">Education</h3>
                    <div className="timeline-container">
                      {renderTimelineText(currentCoach.educationDetails)}
                    </div>
                  </div>

                </div>
              </div>

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

              <div className="footer-action">
                <button 
                  className={`hire-btn ${currentCoach.hiredByCurrentUser ? 'hired' : ''}`}
                  onClick={() => handleHireCoach(currentCoach)}
                  disabled={hiring || currentCoach.hiredByCurrentUser}
                >
                  {currentCoach.hiredByCurrentUser ? (
                    <>
                      <span>✓</span> Coach Hired & Active
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      {hiring ? 'Processing Hiring...' : 'Hire Coach & Pay'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="footer-microcopy">
              🔒 You will be redirected to a secure payment gateway to complete your payment.
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
