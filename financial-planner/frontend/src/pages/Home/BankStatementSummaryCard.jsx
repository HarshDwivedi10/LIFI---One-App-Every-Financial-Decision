import React from 'react';
import DashboardCard from './DashboardCard';
import { useNavigate } from 'react-router-dom';

const fmt = (n) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}k`
    : `₹${Math.round(n)}`;

export default function BankStatementSummaryCard({ loading, statementData }) {
  const navigate = useNavigate();

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );

  return (
    <DashboardCard
      title="Bank Statement Summary"
      icon={icon}
      iconBg="rgba(59,130,246,0.12)"
      iconColor="var(--info)"
      loading={loading}
      skeletonLines={2}
      className="bank-statement-summary-card"
    >
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {statementData ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Uploaded</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {new Date(statementData.lastUploaded).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg. Monthly Savings</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)' }}>
                  {fmt(statementData.avgSavings)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-card-alt)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Income</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)' }}>{fmt(statementData.totalIncome)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Expenses</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--danger)' }}>{fmt(statementData.totalExpenses)}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ padding: '1rem', flex: 1 }}>
            <p>Upload your first bank statement.</p>
            <button className="primary-btn-sm" onClick={() => navigate('/expense-management')}>
              Upload Statement
            </button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
