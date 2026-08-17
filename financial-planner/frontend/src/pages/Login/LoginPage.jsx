import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import './Login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Forced password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);

  const { login, user: authUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError('');
    try {
      const userData = await login(email, password);
      if (userData.mustChangePassword) {
        // Don't navigate — show the forced password change screen
        setPendingUserData(userData);
        setMustChangePassword(true);
      } else if (userData.role === 'ROLE_ADMIN') {
        navigate('/admin');
      } else if (userData.role === 'ROLE_COACH') {
        navigate('/coach');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to login', err);
      const serverMsg = err.response?.data?.message || err.response?.data?.error || 'Invalid email or password.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    setForgotLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await authApi.forgotPassword(email);
      setSuccessMsg('A temporary password has been sent to your email. Log in with it and you will be asked to set a new password.');
      setIsForgotMode(false);
    } catch (err) {
      console.error('Failed to reset password', err);
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setChangePassLoading(true);
    setError('');
    try {
      await authApi.changePassword(newPassword);
      // Now fully set the user session and navigate
      const userData = pendingUserData;
      localStorage.setItem('finance_user', JSON.stringify(userData));
      // Re-trigger auth context state by forcing a reload (simplest safe approach)
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to change password', err);
      setError(err.response?.data?.error || 'Failed to update password. Please try again.');
    } finally {
      setChangePassLoading(false);
    }
  };

  // ─── Forced Password Change Screen ─────────────────────────────────────
  if (mustChangePassword) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-brand" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/lifi-logo.png"
              alt="LI.FI - One App Every Financial Decision"
              style={{ width: '320px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}
            />
          </div>

          <div className="auth-header">
            <h1>Set New Password</h1>
            <p>You logged in with a temporary password. Please set a new secure password to continue.</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-danger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="auth-form">
            <div className="form-group">
              <label className="auth-field-label" htmlFor="new-password">New Password</label>
              <div className="auth-input-wrapper">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changePassLoading}
                  autoFocus
                  style={{ paddingRight: '40px' }}
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="auth-field-label" htmlFor="confirm-password">Confirm New Password</label>
              <div className="auth-input-wrapper">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changePassLoading}
                  style={{ paddingRight: '40px' }}
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password strength hint */}
            {newPassword.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {[...Array(4)].map((_, i) => {
                  const strength = newPassword.length >= 8 ? 4 : newPassword.length >= 6 ? 2 : 1;
                  return (
                    <div key={i} style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '2px',
                      background: i < strength
                        ? (strength >= 4 ? '#10B981' : strength >= 2 ? '#F59E0B' : '#EF4444')
                        : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.3s ease'
                    }} />
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={changePassLoading || !newPassword || !confirmPassword}
            >
              {changePassLoading ? (
                <>
                  <div className="auth-spinner" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Set New Password & Continue</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Normal Login / Forgot Password Screen ──────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card">
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
          <button className="auth-switch-tab active" type="button">Sign In</button>
          <Link to="/register" className="auth-switch-tab">Create Account</Link>
        </div>

        {/* Form Header */}
        <div className="auth-header">
          <h1>{isForgotMode ? 'Reset Password' : 'Welcome Back'}</h1>
          <p>{isForgotMode ? 'Enter your email to receive a temporary password' : 'Sign in to manage your money and goals'}</p>
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

        {isForgotMode ? (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="form-group">
              <label className="auth-field-label" htmlFor="reset-email">Email Address</label>
              <div className="auth-input-wrapper">
                <input
                  id="reset-email"
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={forgotLoading}
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              className="auth-btn-primary"
              disabled={forgotLoading || !email.trim()}
            >
              {forgotLoading ? (
                <>
                  <div className="auth-spinner" />
                  <span>Sending Email...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => { setIsForgotMode(false); setError(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="auth-field-label" htmlFor="email">Email Address</label>
              <div className="auth-input-wrapper">
                <input
                  id="email"
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="auth-field-label" htmlFor="password">Password</label>
              <div className="auth-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setIsForgotMode(true); setError(''); setSuccessMsg(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? (
                <>
                  <div className="auth-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create Account</Link>
        </div>
      </div>
    </div>
  );
}
