import React from 'react';

export default function HomePage() {
  return (
    <div className="page-container flex flex-col items-center justify-center" style={{ minHeight: '80vh', textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <h2 style={{ color: 'var(--text-secondary)' }}>Welcome to FinancePlanner</h2>
      <p className="text-muted" style={{ maxWidth: '400px', marginTop: '8px' }}>
        Use the navigation bar above to manage your expenses, plan your retirement, or manage your investments.
      </p>
    </div>
  );
}
