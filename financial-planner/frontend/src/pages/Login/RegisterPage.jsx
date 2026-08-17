import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

// Password strength calculator
const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { label: '', color: '' },
    { label: 'Very Weak', color: '#ef4444' },
    { label: 'Weak', color: '#f97316' },
    { label: 'Fair', color: '#eab308' },
    { label: 'Strong', color: '#22c55e' },
    { label: 'Very Strong', color: '#10b981' },
  ];
  return { score, ...levels[score] };
};

export default function RegisterPage() {
  const [role, setRole] = useState('USER');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [resumeBase64, setResumeBase64] = useState('');
  const [fileName, setFileName] = useState('');

  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  // Field-level validation state
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const { register } = useAuth();
  const navigate = useNavigate();

  const strength = getPasswordStrength(password);

  // Inline validation helpers
  const nameError = touched.name && !name.trim() ? 'Name is required' : '';
  const emailError = touched.email && !email.trim() ? 'Email is required'
    : touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address' : '';
  const passwordError = touched.password && !password ? 'Password is required'
    : touched.password && password.length < 6 ? 'Password must be at least 6 characters' : '';

  const isFormValid = name.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setResumeBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });

    if (!isFormValid) {
      setError('Please fix the errors above before continuing.');
      return;
    }

    if (role === 'COACH' && !resumeBase64) {
      setError('Please upload your resume to register as a coach.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!otpSent) {
      try {
        setOtpLoading(true);
        await authApi.sendRegistrationOtp(email);
        setOtpSent(true);
        setSuccessMsg('A 6-digit verification code has been sent to your email.');
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to send OTP. Please check your email.');
      } finally {
        setOtpLoading(false);
        setLoading(false);
      }
      return;
    }

    if (!otp.trim()) {
      setError('Please enter the OTP sent to your email.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name,
        email,
        password,
        role,
        ...(role === 'COACH' && { resumeBase64 }),
        otp
      };

      const result = await register(payload);

      if (result.user) {
        localStorage.removeItem('hasCompletedOnboarding');
        navigate('/onboarding');
      } else {
        setIsRegistered(true);
        setSuccessMsg(result.message || 'Registration successful. Pending admin approval.');
      }
    } catch (err) {
      console.error('Failed to register', err);
      const serverMsg = err?.response?.data?.error;
      setError(serverMsg || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        {/* Brand Header */}
        <div className="auth-brand" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
          <img
            src="/lifi-logo.png"
            alt="LI.FI - One App Every Financial Decision"
            style={{ width: '320px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}
          />
        </div>

        {/* Tab Switcher */}
        <div className="auth-switch-tabs">
          <Link to="/login" className="auth-switch-tab">Sign In</Link>
          <button className="auth-switch-tab active" type="button">Create Account</button>
        </div>

        {/* Form Header */}
        <div className="auth-header">
          <h1>Get Started</h1>
          <p>Take control of your wealth and future</p>
        </div>

        {/* Role Selector Pills */}
        <div className="auth-role-selector">
          <button
            type="button"
            className={`auth-role-pill ${role === 'USER' ? 'active' : ''}`}
            onClick={() => { setRole('USER'); setError(''); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Personal User</span>
          </button>
          <button
            type="button"
            className={`auth-role-pill ${role === 'COACH' ? 'active' : ''}`}
            onClick={() => { setRole('COACH'); setError(''); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            <span>Financial Coach</span>
          </button>
        </div>

        {error && (
          <div className="auth-alert auth-alert-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>{successMsg}</span>
          </div>
        )}

        {!isRegistered && (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>

            {/* Full Name */}
            <div className="form-group">
              <label className="auth-field-label" htmlFor="reg-name">Full Name</label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-name"
                  type="text"
                  className={`auth-input ${nameError ? 'auth-input-error' : ''}`}
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))}
                  disabled={loading}
                  autoFocus
                />
              </div>
              {nameError && <span className="auth-field-error">{nameError}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="auth-field-label" htmlFor="reg-email">Email Address</label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-email"
                  type="email"
                  className={`auth-input ${emailError ? 'auth-input-error' : ''}`}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  disabled={loading || otpSent}
                />
              </div>
              {emailError && <span className="auth-field-error">{emailError}</span>}
            </div>

            {/* Password with strength bar */}
            <div className="form-group">
              <label className="auth-field-label" htmlFor="reg-password">
                Password
                <span style={{ fontWeight: 400, fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                  (min. 6 characters)
                </span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${passwordError ? 'auth-input-error' : ''}`}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  disabled={loading}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {passwordError && <span className="auth-field-error">{passwordError}</span>}

              {/* Password Strength Bar */}
              {password.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                          transition: 'all 0.3s ease'
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: strength.color, fontWeight: 600 }}>
                    {strength.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', lineHeight: '1.4' }}>
                    {password.length < 6 && '• At least 6 characters  '}
                    {!/[A-Z]/.test(password) && '• One uppercase letter  '}
                    {!/[0-9]/.test(password) && '• One number  '}
                    {!/[^A-Za-z0-9]/.test(password) && '• One special character'}
                  </div>
                </div>
              )}
            </div>

            {/* OTP Field */}
            {otpSent && (
              <div className="form-group">
                <label className="auth-field-label" htmlFor="reg-otp">
                  Email Verification Code
                  <span style={{ fontWeight: 400, fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>(6-digit code sent to your email)</span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    id="reg-otp"
                    type="text"
                    className="auth-input"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    maxLength="6"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    style={{ letterSpacing: '0.3em', fontSize: '20px', textAlign: 'center' }}
                  />
                </div>
              </div>
            )}

            {/* Resume Upload for Coach */}
            {role === 'COACH' && (
              <div className="form-group">
                <label className="auth-field-label">Resume / Credentials</label>
                <label htmlFor="resumeUpload" className="auth-file-upload">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" style={{ margin: '0 auto 6px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fileName ? 'File Selected' : 'Click to Upload Resume'}
                  </div>
                  {fileName ? (
                    <div className="auth-file-name">{fileName}</div>
                  ) : (
                    <div className="auth-file-text">PDF, DOCX up to 5MB</div>
                  )}
                  <input
                    id="resumeUpload"
                    type="file"
                    accept=".pdf,.doc,.docx,.rtf,.txt"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading || !isFormValid}
            >
              {loading || otpLoading ? (
                <>
                  <div className="auth-spinner" />
                  <span>{otpLoading ? 'Sending OTP...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{otpSent ? 'Verify & Create Account' : 'Verify Email & Continue'}</span>
              )}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
