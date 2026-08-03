import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1a1a2e',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 'var(--text-sm)',
      }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 'var(--text-xs)' }}>{label}</p>
        <p style={{ color: '#818cf8', fontWeight: 700 }}>
          ₹{new Intl.NumberFormat('en-IN').format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * SavingsGrowthChart - Monthly savings trend area chart.
 */
export default function SavingsGrowthChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-chart" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m19 9-5 5-4-4-3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>No savings data yet. Start tracking your income and expenses.</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="savings"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#savingsGradient)"
            dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#818cf8', r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
