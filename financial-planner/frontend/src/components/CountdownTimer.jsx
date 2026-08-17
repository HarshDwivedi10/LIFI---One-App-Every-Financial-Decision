import React from 'react';

export default function CountdownTimer({ targetDateStr }) {
  if (!targetDateStr) return null;

  const target = new Date(targetDateStr + 'T00:00:00');
  const now = new Date();

  if (target <= now) {
    return (
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        padding: '8px 16px',
        borderRadius: '24px',
        color: '#10B981',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        Goal Reached!
      </div>
    );
  }

  // Calculate Years, Months, Days
  let years = target.getFullYear() - now.getFullYear();
  let months = target.getMonth() - now.getMonth();
  let days = target.getDate() - now.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const pad = (num) => String(num).padStart(2, '0');

  const TimeBlock = ({ value, label, showSeparator }) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '64px' }}>
        <div style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'monospace' }}>
          {pad(value)}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.6, marginTop: '4px', letterSpacing: '1px' }}>
          {label}
        </div>
      </div>
      {showSeparator && (
        <div style={{ fontSize: '24px', fontWeight: '700', margin: '0 8px', opacity: 0.5, paddingBottom: '16px' }}>
          :
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: 'rgba(255, 255, 255, 0.03)',
      padding: '16px 28px',
      borderRadius: '32px',
      color: '#F97316',
      border: '1px solid rgba(249, 115, 22, 0.15)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <TimeBlock value={years} label="YRS" showSeparator={true} />
      <TimeBlock value={months} label="MONTHS" showSeparator={true} />
      <TimeBlock value={days} label="DAYS" showSeparator={false} />
    </div>
  );
}
