import React, { useMemo } from 'react';

const SCORE_COLORS = {
  excellent: '#10b981',
  good: '#6366f1',
  needsImprovement: '#f59e0b',
  poor: '#ef4444',
};

function getScoreConfig(score) {
  if (score >= 80) return { label: 'Excellent', cls: 'excellent', color: SCORE_COLORS.excellent, desc: 'Great financial discipline! Keep building wealth.' };
  if (score >= 60) return { label: 'Good', cls: 'good', color: SCORE_COLORS.good, desc: 'Solid progress. A few tweaks can level you up.' };
  if (score >= 40) return { label: 'Needs Improvement', cls: 'needs-improvement', color: SCORE_COLORS.needsImprovement, desc: 'Focus on reducing expenses and growing savings.' };
  return { label: 'Critical', cls: 'poor', color: SCORE_COLORS.poor, desc: 'Action needed. Review your budget and goals immediately.' };
}

/**
 * HealthScoreRing - Circular progress indicator for financial health score.
 */
export default function HealthScoreRing({ score = 0, loading = false }) {
  const config = useMemo(() => getScoreConfig(score), [score]);

  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  if (loading) {
    return (
      <div className="health-score-container">
        <div className="skeleton" style={{ width: 140, height: 140, borderRadius: '50%' }} />
        <div className="skeleton skeleton-line" style={{ width: '80%' }} />
      </div>
    );
  }

  return (
    <div className="health-score-container">
      <div className="health-score-ring">
        <svg width={size} height={size}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1s ease, stroke 0.4s ease',
              filter: `drop-shadow(0 0 6px ${config.color}88)`,
            }}
          />
        </svg>
        <div className="health-score-center">
          <div className="health-score-number" style={{ color: config.color }}>
            {score}
          </div>
          <div className="health-score-label">/ 100</div>
        </div>
      </div>

      <div className="health-score-status">
        <div className={`health-status-badge ${config.cls}`}>
          <span>●</span>
          {config.label}
        </div>
        <p className="health-score-desc">{config.desc}</p>
      </div>
    </div>
  );
}
