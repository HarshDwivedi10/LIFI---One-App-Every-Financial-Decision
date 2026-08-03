import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const FUND_COLORS = [
  '#f59e0b', // Retirement
  '#ef4444', // Emergency
  '#6366f1', // Travel/Short
  '#3b82f6', // Education
  '#10b981', // Investment/Wealth
  '#8b5cf6', // Others
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1a1a2e',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 'var(--text-sm)',
      }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 'var(--text-xs)' }}>{payload[0].name}</p>
        <p style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

/**
 * FundAllocationChart - Donut pie chart for fund allocation with legend.
 */
export default function FundAllocationChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-chart" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" strokeLinecap="round" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
        <p>Set up your fund allocations to see the breakdown.</p>
      </div>
    );
  }

  const coloredData = data.map((item, i) => ({
    ...item,
    color: FUND_COLORS[i % FUND_COLORS.length],
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={coloredData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {coloredData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="transparent"
                style={{ filter: `drop-shadow(0 0 4px ${entry.color}66)` }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="fund-legend">
        {coloredData.map((item, i) => (
          <div key={i} className="fund-legend-item">
            <span className="fund-legend-label">
              <span className="fund-legend-dot" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="fund-legend-value">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
