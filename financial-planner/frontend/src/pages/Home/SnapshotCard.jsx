import React from 'react';

/**
 * SnapshotCard - A single metric card with icon, title, value and trend.
 */
export default function SnapshotCard({
  icon,
  title,
  value,
  trend,
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  accentColor = 'var(--accent-primary)',
  iconBg = 'rgba(99,102,241,0.12)',
  topBar = 'var(--accent-gradient)',
  loading = false,
}) {
  if (loading) {
    return (
      <div className="snapshot-card">
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-value" />
        <div className="skeleton skeleton-line" style={{ width: '55%' }} />
      </div>
    );
  }

  return (
    <div
      className="snapshot-card"
      style={{ '--card-icon-bg': iconBg, '--card-icon-color': accentColor, '--card-accent-color': topBar }}
    >
      <div className="snapshot-card-icon">
        {icon}
      </div>
      <div className="snapshot-card-title">{title}</div>
      <div className="snapshot-card-value">{value}</div>
      {trend && (
        <div className={`snapshot-card-trend trend-${trendDirection}`}>
          {trendDirection === 'up' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
          {trendDirection === 'down' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          {trend}
        </div>
      )}
    </div>
  );
}
