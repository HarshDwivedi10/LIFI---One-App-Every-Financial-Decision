import { useMemo } from 'react';
import { formatCurrency, formatCurrencyFull, FUND_TYPES } from '../../utils/constants';
import './FinancialSummary.css';

export default function FinancialSummary({ incomeData, transactions, assets, onBack, onComplete }) {
  const summary = useMemo(() => {
    const salary = parseFloat(incomeData.monthlySalary) || 0;
    const otherIncome = incomeData.otherSources.reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
    const totalMonthlyIncome = salary + otherIncome;

    const txnIncome = transactions
      .filter((t) => t.type === 'INCOME' || t.type === 'CREDIT')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const txnExpenses = transactions
      .filter((t) => t.type === 'EXPENSE' || t.type === 'DEBIT')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.value || a.currentValue) || 0), 0);
    const netWorth = totalAssets;

    const availableSavings = totalMonthlyIncome - txnExpenses;

    // Fund breakdown
    const fundTotals = FUND_TYPES.reduce((acc, f) => {
      acc[f.id] = assets.reduce((s, a) => {
        if (a.assignedCorpus) {
          if (a.assignedCorpus === f.id) return s + (parseFloat(a.value) || 0);
          return s;
        }
        const alloc = a.fundAllocations?.find((al) => al.fundType === f.id);
        if (!alloc) return s;
        return s + ((parseFloat(a.currentValue) || 0) * (alloc.percentage / 100));
      }, 0);
      return acc;
    }, {});

    return {
      totalMonthlyIncome,
      txnIncome,
      txnExpenses,
      totalAssets,
      netWorth,
      availableSavings,
      fundTotals,
      savingsRate: totalMonthlyIncome > 0 ? ((availableSavings / totalMonthlyIncome) * 100).toFixed(1) : 0,
    };
  }, [incomeData, transactions, assets]);

  // Retirement savings (EPF + PPF + NPS + retirement-allocated assets)
  const retirementSavings = useMemo(() => {
    return assets
      .filter((a) => a.assignedCorpus === 'RETIREMENT' || ['EPF', 'PPF', 'NPS'].includes(a.assetType) ||
        a.fundAllocations?.some((al) => al.fundType === 'RETIREMENT'))
      .reduce((s, a) => {
        if (a.assignedCorpus === 'RETIREMENT') return s + (parseFloat(a.value) || 0);
        const alloc = a.fundAllocations?.find((al) => al.fundType === 'RETIREMENT');
        const pct = alloc ? alloc.percentage / 100 : 1;
        return s + (parseFloat(a.currentValue) || 0) * pct;
      }, 0);
  }, [assets]);

  return (
    <div className="summary-page">
      {/* Header */}
      <header className="summary-header">
        <div className="onboarding-logo">
          <div className="logo-icon">₹</div>
          <span className="logo-text">FinPlan</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Edit Profile
        </button>
      </header>

      <div className="summary-container animate-fade-in">
        {/* Hero */}
        <div className="summary-hero">
          <div className="summary-hero-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Financial Profile Created
          </div>
          <h1 className="summary-hero-title">
            Your <span className="text-gradient">Financial Snapshot</span>
          </h1>
          <p className="summary-hero-sub">
            Here's a complete overview of your finances. Review before we plan your future.
          </p>
        </div>

        {/* KPI Grid */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-income">
            <div className="kpi-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="kpi-label">Monthly Income</div>
            <div className="kpi-value">{formatCurrency(summary.totalMonthlyIncome)}</div>
            <div className="kpi-sub">This is your average monthly income/salary</div>
          </div>
          <div className="kpi-card kpi-expense">
            <div className="kpi-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div className="kpi-label">Monthly Expenses</div>
            <div className="kpi-value">{formatCurrency(summary.txnExpenses)}</div>
            <div className="kpi-sub">This is your average monthly expense</div>
          </div>
          <div className="kpi-card kpi-savings">
            <div className="kpi-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="16" y1="18" x2="16.01" y2="18"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/></svg>
            </div>
            <div className="kpi-label">Available Savings</div>
            <div className="kpi-value">{formatCurrency(summary.availableSavings)}</div>
            <div className="kpi-sub" style={{ lineHeight: 1.4, marginTop: '4px' }}>
              Your funds will be allocated as per your monthly savings
            </div>
          </div>
        </div>

        {/* System Information Banner */}
        <div className="info-banner" style={{
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{ color: 'var(--accent)', marginTop: '2px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
              How Your Data Is Used
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
              On your <strong>Salary Day (Day {incomeData.salaryDay || 1} of every month)</strong>, your monthly data will be automatically updated. The system assumes your new income has arrived and integrates your average predicted expenses for the month. Accordingly, your monthly savings are calculated and your funds are automatically allocated on this day.
            </p>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="summary-grid-2">
          {/* Assets & Liabilities */}
          <div className="summary-card">
            <div className="summary-card-header">
              <h3>Total Assets</h3>
            </div>
            <div className="summary-detail-row">
              <span>Total Assets</span>
              <span className="val-positive">{formatCurrencyFull(summary.totalAssets)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-detail-row summary-total-row">
              <span>Net Worth</span>
              <span className="val-positive">
                {formatCurrencyFull(summary.netWorth)}
              </span>
            </div>
          </div>

          {/* Income Breakdown */}
          <div className="summary-card">
            <div className="summary-card-header">
              <h3>Income Breakdown</h3>
            </div>
            <div className="summary-detail-row">
              <span>Monthly Salary</span>
              <span className="val-positive">{formatCurrency(parseFloat(incomeData.monthlySalary) || 0)}</span>
            </div>
            {incomeData.otherSources.map((s) => (
              <div key={s.id} className="summary-detail-row">
                <span>{s.type}{s.description ? ` · ${s.description}` : ''}</span>
                <span className="val-positive">{formatCurrency(parseFloat(s.amount) || 0)}</span>
              </div>
            ))}
            <div className="summary-divider" />
            <div className="summary-detail-row summary-total-row">
              <span>Available Savings</span>
              <span className={summary.availableSavings >= 0 ? 'val-positive' : 'val-negative'}>
                {formatCurrency(summary.availableSavings)}
              </span>
            </div>
          </div>
        </div>

        {/* Fund Breakdown */}
        {summary.totalAssets > 0 && (
          <div className="summary-card">
            <div className="summary-card-header">
              <h3>Assets by Fund Type</h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Total: {formatCurrencyFull(summary.totalAssets)}
              </span>
            </div>
            <div className="fund-breakdown-grid">
              {FUND_TYPES.map((f) => {
                const val = summary.fundTotals[f.id];
                if (!val) return null;
                const pct = (val / summary.totalAssets) * 100;
                return (
                  <div key={f.id} className="fund-card">
                    <span className={`badge ${f.badge}`}>{f.label.replace(' Fund', '')}</span>
                    <div className="fund-value">{formatCurrencyFull(val)}</div>
                    <div className="fund-bar-track">
                      <div
                        className="fund-bar-fill"
                        style={{ width: `${pct}%`, background: f.color }}
                      />
                    </div>
                    <div className="fund-pct">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Onboarding Complete CTA */}
        <div className="retirement-cta" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="retirement-cta-content">
            <div className="retirement-cta-icon" style={{ background: 'var(--success)', color: '#fff' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <h3>Welcome to FinPlanner!</h3>
              <p>
                Your financial profile is complete. Now, let's start managing your goals and charting your path to success.
              </p>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onComplete} style={{ background: 'var(--success)', borderColor: 'var(--success)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            Start Planning Goals
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
