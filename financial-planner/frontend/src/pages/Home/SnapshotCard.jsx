import React from "react";

export default function SnapshotCard({
  icon,
  title,
  value,
  trend,
  trendDirection = "neutral",
  accentColor = "#6366f1",
  iconBg = "#EEF2FF",
  topBar = "linear-gradient(90deg,#6366f1,#8b5cf6)",
  loading = false,
}) {
  if (loading) {
    return (
      <div className="snapshot-card">
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
        <div className="skeleton skeleton-value" />
        <div className="skeleton skeleton-line" style={{ width: "55%" }} />
      </div>
    );
  }

  const renderGraphic = () => {
    switch (title) {
      case "Total Savings":
        return (
          <svg width="90" height="55" viewBox="0 0 90 55">
            <path
              d="M5 42 C18 36 25 18 40 24 C52 30 60 12 85 18"
              stroke="#8B5CF6"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        );

      case "Monthly Savings":
        return (
          <svg width="70" height="55" viewBox="0 0 70 55">
            <rect x="6" y="34" width="6" height="15" rx="2" fill="#22C55E" />
            <rect x="18" y="28" width="6" height="21" rx="2" fill="#22C55E" />
            <rect x="30" y="20" width="6" height="29" rx="2" fill="#22C55E" />
            <rect x="42" y="12" width="6" height="37" rx="2" fill="#22C55E" />
            <rect x="54" y="25" width="6" height="24" rx="2" fill="#22C55E" />
          </svg>
        );

      case "Retirement Countdown":
        return (
          <div style={{ fontSize: "42px", opacity: 0.7 }}>
            ⏳
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="snapshot-card"
      style={{
        "--card-icon-bg": iconBg,
        "--card-icon-color": accentColor,
        "--card-accent-color": topBar,
      }}
    >
      <div className="snapshot-left">
        <div
          className="snapshot-card-icon"
          style={{
            background: iconBg,
            color: accentColor,
          }}
        >
          {icon}
        </div>

        <div className="snapshot-card-content">
          <div className="snapshot-card-title">{title}</div>

          <div className="snapshot-card-value">{value}</div>

          {trend && (
            <div className={`snapshot-card-trend trend-${trendDirection}`}>
              {trendDirection === "up" && <span>↗</span>}
              {trendDirection === "down" && <span>↘</span>}
              {trend}
            </div>
          )}
        </div>
      </div>

      <div className="snapshot-right">
        {renderGraphic()}
      </div>
    </div>
  );
}