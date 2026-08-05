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
  '#6366f1', // Travel
  '#3b82f6', // Education
  '#10b981', // Investment
  '#8b5cf6', // Others
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: '14px',
        }}
      >
        <p
          style={{
            color: 'var(--text-muted)',
            marginBottom: 4,
            fontSize: '12px',
          }}
        >
          {payload[0].name}
        </p>

        <p
          style={{
            color: payload[0].payload.color,
            fontWeight: 700,
          }}
        >
          {payload[0].value}%
        </p>
      </div>
    );
  }

  return null;
};

export default function FundAllocationChart({
  data = [],
  loading = false,
}) {
  if (loading) {
    return <div className="skeleton skeleton-chart" />;
  }

  if (!data.length) {
    return (
      <div className="empty-state">
        <p>No fund allocation available.</p>
      </div>
    );
  }

  const coloredData = data.map((item, i) => ({
    ...item,
    color: FUND_COLORS[i % FUND_COLORS.length],
  }));

  return (
    <div className="fund-allocation-container">

      {/* Left Side */}
      <div className="fund-legend">
        {coloredData.map((item, i) => (
          <div key={i} className="fund-legend-item">
            <span className="fund-legend-label">
              <span
                className="fund-legend-dot"
                style={{ background: item.color }}
              />
              {item.name}
            </span>

            <span className="fund-legend-value">
              {item.value}%
            </span>
          </div>
        ))}
      </div>

      {/* Right Side */}
      <div className="fund-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={coloredData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={3}
            >
              {coloredData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                />
              ))}
            </Pie>

            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}