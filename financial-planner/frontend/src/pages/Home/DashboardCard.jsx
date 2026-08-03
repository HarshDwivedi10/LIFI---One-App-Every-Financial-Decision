import React from 'react';
import './DashboardPage.css';

export default function DashboardCard({ 
  title, 
  icon, 
  iconBg, 
  iconColor, 
  badge, 
  headerRight, 
  loading, 
  skeletonLines = 3, 
  className = '', 
  children,
  style = {}
}) {
  return (
    <div className={`section-card ${className}`} style={style}>
      <div className="section-card-header">
        <div className="section-card-title">
          {icon && (
            <div className="title-icon" style={{ background: iconBg || 'rgba(99,102,241,0.12)', color: iconColor || 'var(--accent-primary)' }}>
              {icon}
            </div>
          )}
          {title}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {badge && <span className="badge-new">{badge}</span>}
          {headerRight && <div>{headerRight}</div>}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
            {Array.from({ length: skeletonLines }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" style={{ height: 40 }} />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
