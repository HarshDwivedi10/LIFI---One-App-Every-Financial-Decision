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

export default function GoalProgressCard({ goals, loading }) {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case 'On Track': return 'var(--success)';
      case 'Delayed': return 'var(--warning)';
      case 'Completed': return 'var(--accent-primary)';
      default: return 'var(--text-muted)';
    }
  };

  const calculateStatus = (goal) => {
    if (goal.currentAmount >= goal.targetAmount) return 'Completed';
    return goal.isDelayed ? 'Delayed' : 'On Track';
  };

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );

  return (
    <DashboardCard
      title="Goal Progress"
      icon={icon}
      iconBg="rgba(59,130,246,0.12)"
      iconColor="var(--info)"
      loading={loading}
      className="goal-progress-card"
    >
      <div className="goal-table-container">
        {goals && goals.length > 0 ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Target</th>
                <th>Saved</th>
                <th>Progress</th>
                <th>Target Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal) => {
                const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                const status = calculateStatus(goal);
                
                return (
                  <tr key={goal.id || goal._id || goal.name} onClick={() => navigate('/goal-management')} className="clickable-row">
                    <td className="fw-600">{goal.name}</td>
                    <td>{fmt(goal.targetAmount)}</td>
                    <td>{fmt(goal.currentAmount)}</td>
                    <td style={{ minWidth: '120px' }}>
                      <div className="progress-bar-bg" style={{ height: '6px', width: '100%', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="progress-bar-fill" style={{ height: '100%', width: `${progress}%`, background: getStatusColor(status), borderRadius: '4px' }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{progress.toFixed(0)}%</div>
                    </td>
                    <td>{new Date(goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                    <td>
                      <span className={`status-badge ${status.replace(' ', '-').toLowerCase()}`} style={{ color: getStatusColor(status), background: `${getStatusColor(status)}20`, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p>No goals set yet. Start planning your future!</p>
            <button className="primary-btn-sm" onClick={() => navigate('/goal-management')}>Add Goal</button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
