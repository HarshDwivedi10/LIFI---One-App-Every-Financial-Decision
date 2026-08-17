import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useFinancialData from '../../hooks/useFinancialData';
import CountdownTimer from '../../components/CountdownTimer';
import api from '../../services/api';
import './DashboardPage.css';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const {
    loading,
    funds,
    metadata,
    allocations,
    expectedMonthlySavings,
    liveTotalSavings,
    preExistingSavings,
    lastDiscrepancySource
  } = useFinancialData();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const calculateRupees = (pct) => (expectedMonthlySavings * (pct / 100));

  // Determine discrepancy
  const totalStoredAssets = funds.reduce((sum, f) => sum + (f.storedAssetBalance || 0), 0);
  const totalHistoricalSavings = liveTotalSavings - expectedMonthlySavings;
  const discrepancy = Math.round(totalHistoricalSavings - totalStoredAssets);

  // Filter for actual active custom goals (ignoring UNALLOCATED)
  const activeGoals = funds.filter(f => f.id !== 'UNALLOCATED');

  if (loading) {
    return (
      <div className="home-container">
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* ── Header ── */}
      <header className="home-header">
        <div>
          <h1>Welcome, {user?.name || 'User'}</h1>
          <p>Here is your financial overview.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>

          <button 
            onClick={handleLogout} 
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              color: '#f87171',
              padding: '10px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Priority System Warning Banner ── */}
      <div className="priority-banner">
        <div className="priority-banner-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <p>
          <strong>Priority Funding Active:</strong> Goals are prioritized based on their target date. Goals with earlier deadlines will always be funded first, which may impact funding for later goals.
        </p>
      </div>

      {/* ── Discrepancy Banner (If Any) ── */}
      {Math.abs(discrepancy) > 0 && !loading && (
        <div style={{ width: '100%', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '12px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             <span style={{ color: '#F97316', fontSize: '15px', fontWeight: 500 }}>
                Discrepancy Detected: Your Total Savings {discrepancy > 0 ? 'increased' : 'decreased'} by ₹{new Intl.NumberFormat('en-IN').format(Math.abs(discrepancy))}. {lastDiscrepancySource ? `(Reason: ${lastDiscrepancySource})` : 'due to past updates.'}
             </span>
          </div>
          <button onClick={() => navigate('/fund-management')} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
             Resolve in Fund Management
          </button>
        </div>
      )}

      <div className="dashboard-content">
        {activeGoals.length === 0 ? (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h2>Active Goals Tracker</h2>
            <p>No active goals found. Start planning your future.</p>
            <button className="create-goal-btn" onClick={() => navigate('/goal-management')}>
              Create a Goal
            </button>
          </div>
        ) : (
          <>
            {activeGoals.map(fund => {
              const meta = metadata[fund.id] || {};
              const target = meta.targetAmount || 0;
              const balance = fund.storedAssetBalance || 0;
              const isAchieved = target > 0 && balance >= target;
              const val = allocations[fund.id] || 0;
              const monthlyRs = calculateRupees(val);
              
              let progressPct = 0;
              if (target > 0) {
                progressPct = Math.min(100, Math.round((balance / target) * 100));
              }

              let isFrozen = false;
              if (meta.targetDate) {
                const targetTime = new Date(meta.targetDate + 'T00:00:00').getTime();
                if (new Date().getTime() >= targetTime) {
                  isFrozen = true;
                }
              }

              return (
                <div key={fund.id} className={`goal-tracker-card ${isAchieved ? 'achieved' : ''}`}>
                  <div className="goal-header">
                    <div className="goal-title-group">
                      <h3 className="goal-title">{fund.name}</h3>
                      <div className="goal-target">
                        Target: <span className="goal-target-amount">₹{new Intl.NumberFormat('en-IN').format(target)}</span>
                        {(!isAchieved && !isFrozen) && (
                           <span className="goal-monthly">
                             + ₹{new Intl.NumberFormat('en-IN').format(Math.round(monthlyRs))} / mo
                           </span>
                        )}
                        {isFrozen && !isAchieved && (
                           <span className="goal-monthly" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                             Frozen (Deadline Passed)
                           </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {isAchieved ? (
                        <div className="achieved-badge">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Goal Achieved
                        </div>
                      ) : meta.targetDate ? (
                        <div className="goal-timer-wrapper">
                          <CountdownTimer targetDateStr={meta.targetDate} />
                          <div className="goal-timer-label">Time Remaining</div>
                        </div>
                      ) : (
                         <div className="goal-timer-wrapper">
                           <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>No Target Date</span>
                         </div>
                      )}
                    </div>
                  </div>

                  <div className="goal-progress-section">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                    </div>
                    <div className="goal-progress-stats">
                      <div className="goal-balance">
                        ₹{new Intl.NumberFormat('en-IN').format(Math.round(balance))}
                      </div>
                      <div className="goal-percentage">
                        {progressPct}% Funded
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
