import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function RegisterPage() {
  const [role, setRole] = useState('USER'); // 'USER' or 'COACH'
  
  // Base fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Coach specific fields
  const [resumeBase64, setResumeBase64] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setResumeBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    if (role === 'COACH') {
      if (!resumeBase64) {
        setError('Please upload your resume to register as a coach.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = {
        name,
        email,
        password,
        role,
        ...(role === 'COACH' && {
          resumeBase64
        })
      };

      const result = await register(payload);
      
      if (result.user) {
        // Force onboarding for newly registered standard users
        localStorage.removeItem('hasCompletedOnboarding'); 
        navigate('/onboarding');
      } else {
        // Coach registration pending
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
    <div className="auth-layout" style={{ minHeight: '100vh', overflowY: 'auto' }}>
      {/* LEFT SIDEBAR - VISUALS */}
      <div className="auth-sidebar" style={{ position: 'fixed', width: '40%', height: '100vh' }}>
        <div className="auth-branding">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            LiFi
          </div>
          <h2>Join us to take control of your financial future.</h2>
          <p>Gain insights, track growth, and automatically calculate your exact path to early retirement.</p>
          
          <div className="auth-features">
            <div className="auth-feature-tag">Secure</div>
            <div className="auth-feature-tag">Ad-Free</div>
            <div className="auth-feature-tag">100% Privacy</div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="auth-content" style={{ marginLeft: '40%', width: '60%', minHeight: '100vh', padding: '2rem' }}>
        <div className="auth-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Get started with LiFi today.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button 
              type="button" 
              className={`btn ${role === 'USER' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRole('USER')}
              style={{ flex: 1 }}
            >
              Register as User
            </button>
            <button 
              type="button" 
              className={`btn ${role === 'COACH' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRole('COACH')}
              style={{ flex: 1 }}
            >
              Register as Coach
            </button>
          </div>

          {role === 'USER' && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--success)' }}>What happens next?</strong><br/>
              After you register, you will go through a quick Onboarding Setup. We will help you add your income, track your expenses, and calculate your net worth. You can skip it and configure everything manually if you prefer.
            </div>
          )}
          
          {error && <div className="alert alert-danger" style={{marginBottom: '1.5rem', color: '#ff6b6b', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)'}}>{error}</div>}
          {successMsg && <div className="alert alert-success" style={{marginBottom: '1.5rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)'}}>{successMsg}</div>}

          {!successMsg && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="e.g. john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {role === 'COACH' && (
                <div className="form-group">
                  <label htmlFor="resumeUpload">Upload Your Resume *</label>
                  <input
                    id="resumeUpload"
                    type="file"
                    className="form-input"
                    accept=".pdf,.doc,.docx,.rtf,.txt"
                    onChange={handleFileUpload}
                    disabled={loading}
                    style={{ padding: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)' }}
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>Accepted formats: PDF, DOCX, DOC. Max size 5MB.</small>
                </div>
              )}
              
              <button type="submit" className="btn btn-primary auth-btn" disabled={loading || !name.trim() || !email.trim() || !password.trim()}>
                {loading ? 'Creating Account...' : 'Register'}
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '20px' }}>
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
