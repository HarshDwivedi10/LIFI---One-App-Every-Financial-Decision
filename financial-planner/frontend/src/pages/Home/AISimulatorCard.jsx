import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import './DashboardPage.css';

export default function AISimulatorCard() {
  const [query, setQuery] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState(null);

  const examples = [
    'Buy a ₹10L car',
    'Increase salary by 20%',
    'Start a new goal',
    'Retire at 55'
  ];

  const handleSimulate = () => {
    if (!query.trim()) return;
    
    setSimulating(true);
    setResult(null);

    // Mock API call simulation
    setTimeout(() => {
      setSimulating(false);
      setResult([
        { text: 'Retirement delayed by 8 months', type: 'warning' },
        { text: 'House goal delayed by 3 months', type: 'warning' },
        { text: 'Recommended SIP increases by ₹2500', type: 'info' }
      ]);
    }, 1500);
  };

  const handleExampleClick = (ex) => {
    setQuery(ex);
  };

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1a1 1 0 0 1-1 1h-1v1a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7v-1H1a1 1 0 0 1-1-1v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <path d="M15 13v.01"/><path d="M9 13v.01"/>
    </svg>
  );

  return (
    <DashboardCard
      title="AI What-If Simulator"
      icon={icon}
      iconBg="rgba(139,92,246,0.12)"
      iconColor="var(--accent-primary)"
      badge="Beta"
      className="ai-simulator-card"
    >
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            What happens if...
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. I buy a ₹10L car next year" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
              style={{ flex: 1 }}
            />
            <button 
              className="primary-btn-sm" 
              onClick={handleSimulate} 
              disabled={simulating || !query.trim()}
              style={{ background: 'var(--accent-primary)' }}
            >
              {simulating ? 'Simulating...' : 'Simulate'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {examples.map((ex, idx) => (
            <button 
              key={idx} 
              className="tag-btn" 
              onClick={() => handleExampleClick(ex)}
            >
              {ex}
            </button>
          ))}
        </div>

        {result && (
          <div className="simulation-result" style={{ marginTop: '0.5rem', background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Simulation Impact:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {result.map((item, idx) => (
                <li key={idx} style={{ fontSize: '0.875rem', color: item.type === 'warning' ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
