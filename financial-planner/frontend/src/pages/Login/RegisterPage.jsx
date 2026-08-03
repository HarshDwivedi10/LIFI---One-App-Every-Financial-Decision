import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      // Force onboarding for newly registered users
      localStorage.removeItem('hasCompletedOnboarding'); 
      navigate('/onboarding');
    } catch (err) {
      console.error('Failed to register', err);
      setError('Registration failed. Email might already be in use.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* LEFT SIDEBAR - VISUALS */}
      <div className="auth-sidebar">
        <div className="auth-branding">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            FinancePlanner
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
      <div className="auth-content">
        <div className="auth-card" style={{ maxWidth: '460px' }}>
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Get started with FinancePlanner today.</p>
          </div>

          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--success)' }}>What happens next?</strong><br/>
            After you register, you will go through a quick Onboarding Setup. We will help you add your income, track your expenses, and calculate your net worth. You can skip it and configure everything manually if you prefer.
          </div>
          
          {error && <div className="alert alert-danger" style={{marginBottom: '1.5rem', color: '#ff6b6b', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)'}}>{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
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
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <button type="submit" className="btn btn-primary auth-btn" disabled={loading || !name.trim() || !email.trim() || !password.trim()}>
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
