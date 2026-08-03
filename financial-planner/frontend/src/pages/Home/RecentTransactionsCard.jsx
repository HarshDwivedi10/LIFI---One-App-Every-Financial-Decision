import React from 'react';
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

export default function RecentTransactionsCard({ transactions, loading }) {
  // Use top 5 transactions or mock data if empty
  const mockTransactions = [
    { id: 1, date: new Date().toISOString(), category: 'Groceries', description: 'Supermarket', amount: 4500, type: 'EXPENSE' },
    { id: 2, date: new Date(Date.now() - 86400000).toISOString(), category: 'Salary', description: 'Tech Corp', amount: 120000, type: 'INCOME' },
    { id: 3, date: new Date(Date.now() - 172800000).toISOString(), category: 'Utilities', description: 'Electricity Bill', amount: 1800, type: 'EXPENSE' },
    { id: 4, date: new Date(Date.now() - 259200000).toISOString(), category: 'Dining', description: 'Restaurant', amount: 2400, type: 'EXPENSE' },
  ];

  const recentTxns = transactions && transactions.length > 0 
    ? transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5) 
    : mockTransactions;

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );

  return (
    <DashboardCard
      title="Recent Transactions"
      icon={icon}
      iconBg="rgba(16,185,129,0.12)"
      iconColor="var(--success)"
      loading={loading}
      skeletonLines={4}
      className="recent-transactions-card"
    >
      <div className="transactions-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentTxns.map((txn) => {
              const isIncome = txn.type === 'INCOME' || txn.type === 'CREDIT';
              return (
                <tr key={txn.id || txn._id}>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="fw-500">{txn.description || 'Unknown'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', background: 'var(--bg-card-alt)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      {txn.category || 'General'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: isIncome ? 'var(--success)' : 'var(--text-primary)' }}>
                    {isIncome ? '+' : '-'}{fmt(txn.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
