import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './ExpertConnectPage.css';

export default function ExpertConnectPage() {
    const [coaches, setCoaches] = useState([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCoaches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/experts');
            setCoaches(res.data || []);
            setIndex(0);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load financial experts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

    const goPrev = () => setIndex(i => (i - 1 + coaches.length) % coaches.length);
    const goNext = () => setIndex(i => (i + 1) % coaches.length);

    const handleHire = (coach) => {
        toast('Payment integration coming soon!', { icon: '💳' });
    };

    if (loading) {
        return (
            <div className="ec-page">
                <div className="ec-loading">
                    <div className="ec-spinner" />
                    <p>Loading financial experts…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ec-page">
                <h1 className="ec-title">Financial Expert Connect</h1>
                <div className="ec-error">
                    <p>⚠️ {error}</p>
                    <button className="ec-retry-btn" onClick={fetchCoaches}>Retry</button>
                </div>
            </div>
        );
    }

    if (coaches.length === 0) {
        return (
            <div className="ec-page">
                <h1 className="ec-title">Financial Expert Connect</h1>
                <p className="ec-subtitle">
                    Browse expert coaches, review their experience and resume, and hire the right coach for your financial journey.
                </p>
                <div className="ec-empty">
                    <div className="ec-empty-icon">🎓</div>
                    <h3>No experts available yet</h3>
                    <p>Check back soon — new financial coaches are approved regularly.</p>
                </div>
            </div>
        );
    }

    const coach = coaches[index];
    const initials = (coach.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="ec-page">
            <h1 className="ec-title">Financial Expert Connect</h1>
            <p className="ec-subtitle">
                Browse expert coaches, review their experience and resume, and hire the right coach for your financial journey.
            </p>

            <div className="ec-content">
                {coaches.length > 1 && (
                    <button className="ec-arrow ec-arrow-left" onClick={goPrev} aria-label="Previous coach">‹</button>
                )}

                <div className="ec-grid">
                    <div className="ec-card">
                        <div className="ec-card-header">
                            <div className="ec-avatar">{initials}</div>
                            <div>
                                <h2 className="ec-name">{coach.name || '–'}</h2>
                                <p className="ec-role">{coach.title || 'Financial Planning Coach'}</p>
                                {coach.location && <p className="ec-location">📍 {coach.location}</p>}
                            </div>
                        </div>

                        <div className="ec-stats">
                            <div className="ec-stat">
                                <span className="ec-stat-value">{coach.yearsExperience != null ? `${coach.yearsExperience}+ Years` : '–'}</span>
                                <span className="ec-stat-label">Experience</span>
                            </div>
                            <div className="ec-stat">
                                <span className="ec-stat-value">⭐ {coach.rating != null ? `${coach.rating}/5` : '–'}</span>
                                <span className="ec-stat-label">{coach.clientsCount != null ? `${coach.clientsCount}+ Clients` : ''}</span>
                            </div>
                        </div>

                        {coach.about && (
                            <div className="ec-section">
                                <h4>About Coach</h4>
                                <p>{coach.about}</p>
                            </div>
                        )}

                        {coach.expertise && coach.expertise.length > 0 && (
                            <div className="ec-section">
                                <h4>Expertise</h4>
                                <ul className="ec-expertise-list">
                                    {coach.expertise.map((tag, i) => (
                                        <li key={i}>✔ {tag}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {coach.resumeBase64 && (
                            <a href={coach.resumeBase64} download={coach.name + '_Resume'} target="_blank" rel="noreferrer" className="ec-download-btn">
                                ⬇ Download Full CV (PDF)
                            </a>
                        )}
                    </div>

                    <div className="ec-resume">
                        <div className="ec-resume-header">
                            <span>📄 Resume / CV</span>
                            <span className="ec-resume-count">{index + 1} / {coaches.length}</span>
                        </div>

                        <div className="ec-resume-body">
                            <h2 className="ec-resume-name">{coach.name}</h2>
                            <p className="ec-resume-role">{coach.title || 'Financial Planning Coach'}</p>

                            <div className="ec-contact-grid">
                                {coach.email && <span>✉ {coach.email}</span>}
                                {coach.phone && <span>📞 {coach.phone}</span>}
                                {coach.location && <span>📍 {coach.location}</span>}
                                {coach.linkedinUrl && (
                                    <span>
                    🔗 <a href={coach.linkedinUrl} target="_blank" rel="noreferrer">{coach.linkedinUrl.replace(/^https?:\/\//, '')}</a>
                  </span>
                                )}
                            </div>

                            {coach.professionalSummary && (
                                <>
                                    <h3 className="ec-resume-heading">Professional Summary</h3>
                                    <p>{coach.professionalSummary}</p>
                                </>
                            )}

                            {coach.experience && coach.experience.length > 0 && (
                                <>
                                    <h3 className="ec-resume-heading">Experience</h3>
                                    <div className="ec-timeline">
                                        {coach.experience.map((exp, i) => (
                                            <div className="ec-timeline-item" key={i}>
                                                <strong>{exp.title}</strong>
                                                <div className="ec-timeline-meta">{exp.company} {exp.period && `| ${exp.period}`}</div>
                                                {exp.description && <p>{exp.description}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {coach.education && coach.education.length > 0 && (
                                <>
                                    <h3 className="ec-resume-heading">Education</h3>
                                    <div className="ec-timeline">
                                        {coach.education.map((edu, i) => (
                                            <div className="ec-timeline-item" key={i}>
                                                <strong>{edu.degree}</strong>
                                                <div className="ec-timeline-meta">{edu.institution} {edu.year && `| ${edu.year}`}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {coaches.length > 1 && (
                    <button className="ec-arrow ec-arrow-right" onClick={goNext} aria-label="Next coach">›</button>
                )}
            </div>

            <div className="ec-footer">
                <div className="ec-fee">
                    <span className="ec-fee-label">Consultation Fee</span>
                    <span className="ec-fee-value">
            {coach.consultationFee != null ? `₹ ${coach.consultationFee} / session` : 'Contact for pricing'}
          </span>
                </div>
                <div className="ec-secure">
                    🛡 <span>Secure Payment<br /><small>100% Safe & Secure</small></span>
                </div>
                <button className="ec-hire-btn" onClick={() => handleHire(coach)}>
                    💳 Hire Coach &amp; Pay
                </button>
            </div>
            <p className="ec-redirect-note">🔒 You will be redirected to a secure payment gateway to complete your payment.</p>
        </div>
    );
}