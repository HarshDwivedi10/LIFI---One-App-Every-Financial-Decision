import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardCard from "./DashboardCard";
import "./DashboardPage.css";

const fmt = (n) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}k`
    : `₹${Math.round(n)}`;

export default function GoalProgressCard({ goals, loading }) {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case "On Track":
        return "var(--success)";
      case "Delayed":
        return "var(--warning)";
      case "Completed":
        return "var(--accent-primary)";
      default:
        return "var(--text-muted)";
    }
  };

  const calculateStatus = (goal) => {
    if (goal.currentAmount >= goal.targetAmount) return "Completed";
    return goal.isDelayed ? "Delayed" : "On Track";
  };

  const icon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );

  return (
    <DashboardCard
  title="My Goals"
  icon={icon}
  iconBg="rgba(59,130,246,0.12)"
  iconColor="var(--info)"
  loading={loading}
  className="goal-progress-card"
  style={{ height: "520px" }}
>
      <div className="goal-table-container">
        {goals && goals.length > 0 ? (
          <div className="goals-container">
            {goals.map((goal) => {
  const progress = Math.min(
    100,
    (goal.currentAmount / goal.targetAmount) * 100
  );

  const status = calculateStatus(goal);

  return (
    <div
      key={goal.id || goal._id || goal.name}
      className="goal-card"
      onClick={() => navigate("/goal-management")}
    >
      <div className="goal-card-header">
        <div>
          <h4>{goal.name}</h4>

          <span className="goal-date">
            {new Date(goal.targetDate).toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        <span
          className="goal-status"
          style={{
            color: getStatusColor(status),
            background: `${getStatusColor(status)}20`,
          }}
        >
          {status}
        </span>
      </div>

      <div className="goal-amount">
        <strong>{fmt(goal.currentAmount)}</strong>

        <span> / {fmt(goal.targetAmount)}</span>
      </div>

      <div className="goal-progress">
        <div
          className="goal-progress-fill"
          style={{
            width: `${progress}%`,
            background: getStatusColor(status),
          }}
        />
      </div>

      <div className="goal-footer">
        <span>{progress.toFixed(0)}% Completed</span>

        <span>
          {Math.max(
            0,
            Math.ceil(
              (new Date(goal.targetDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            )
          )}{" "}
          days left
        </span>
      </div>
    </div>
  );
})}
          </div>
        ) : (
          <div
            className="empty-state"
            style={{ padding: "2rem 1rem" }}
          >
            <p>No goals set yet. Start planning your future!</p>

            <button
              className="primary-btn-sm"
              onClick={() => navigate("/goal-management")}
            >
              Add Goal
            </button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}