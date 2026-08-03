import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from './DashboardCard';
import './DashboardPage.css';

const fmt = (n) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}k`
    : `₹${Math.round(n)}`;

export default function RetirementSummaryCard({ retirementPlan, loading }) {
  const navigate = useNavigate();

  // Parse data or use mocks
  let targetCorpus = 50000000; // 5 Cr mock
  let currentSavings = 3500000; // 35L mock
  let requiredSIP = 45000;
  let retirementAge = 60;
  let currentAge = 30;

  if (retirementPlan) {
    try {
      const result = retirementPlan.resultJson ? JSON.parse(retirementPlan.resultJson) : {};
      targetCorpus = result.requiredCorpus || targetCorpus;
      requiredSIP = result.monthlyInvestmentRequired || requiredSIP;
      currentSavings = retirementPlan.currentRetirementSavings || currentSavings;
      retirementAge = retirementPlan.retirementAge || retirementAge;
      currentAge = retirementPlan.currentAge || currentAge;
    } catch (e) {
      console.error('Error parsing retirement plan', e);
    }
  }

  const yearsRemaining = retirementAge - currentAge;
  const progress = Math.min(100, (currentSavings / targetCorpus) * 100);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/>
    </svg>
  );

  const headerRight = (
    <button className="text-btn" onClick={() => navigate('/retirement-planner')} style={{ fontSize: '0.85rem' }}>View Details</button>
  );

  return (
    <DashboardCard
      title="Retirement Summary"
      icon={icon}
      iconBg="rgba(245,158,11,0.12)"
      iconColor="var(--warning)"
      headerRight={headerRight}
      loading={loading}
      skeletonLines={2}
      className="retirement-summary-card"
    >
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Target Corpus</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(targetCorpus)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Saved So Far</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--success)' }}>{fmt(currentSavings)}</div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div className="progress-bar-bg" style={{ height: '8px', width: '100%', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="progress-bar-fill" style={{ height: '100%', width: `${progress}%`, background: 'var(--warning)', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            <span>{progress.toFixed(1)}% Completed</span>
            <span>{yearsRemaining} Years to go</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-card-alt)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required Monthly SIP</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(requiredSIP)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retirement Age</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{retirementAge} yrs</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
