import React from 'react';
import DashboardCard from './DashboardCard';
import { useNavigate } from 'react-router-dom';

export default function FinancialCoachCard({ coach, loading, onChatClick, onProfileClick }) {
  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );

  return (
    <DashboardCard
      title="Personal Financial Coach"
      icon={icon}
      iconBg="rgba(16,185,129,0.12)"
      iconColor="var(--success)"
      loading={loading}
      skeletonLines={2}
      className="financial-coach-card"
    >
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {coach ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', background: 'var(--border-subtle)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' 
            }}>
              {coach.photo ? (
                <img src={coach.photo} alt={coach.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{coach.name}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{coach.specialization || 'Wealth Management'}</div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.5rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 0 }}>Want a Coach?</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Get personalized financial advice to help you achieve your goals faster.</p>
          </div>
        )}

        {coach && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1.5rem' }}>
            <button className="secondary-btn-sm" style={{ flex: 1 }} onClick={onProfileClick}>
              View Profile
            </button>
            <button className="primary-btn-sm" style={{ flex: 1, background: 'var(--accent-primary)' }} onClick={onChatClick}>
              Chat
            </button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
