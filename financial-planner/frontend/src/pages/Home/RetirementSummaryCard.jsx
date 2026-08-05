import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardCard from "./DashboardCard";
import "./DashboardPage.css";
import retirementImage from "../../assets/retirement.png";

const fmt = (n) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}k`
    : `₹${Math.round(n)}`;

export default function RetirementSummaryCard({
  retirementPlan,
  loading,
}) {
  const navigate = useNavigate();

  let targetCorpus = 50000000;
  let currentSavings = 3500000;
  let retirementAge = 60;
  let currentAge = 30;

  if (retirementPlan) {
    try {
      const result = retirementPlan.resultJson
        ? JSON.parse(retirementPlan.resultJson)
        : {};

      targetCorpus =
        result.requiredCorpus || targetCorpus;

      currentSavings =
        retirementPlan.currentRetirementSavings ||
        currentSavings;

      retirementAge =
        retirementPlan.retirementAge ||
        retirementAge;

      currentAge =
        retirementPlan.currentAge ||
        currentAge;
    } catch (e) {
      console.error(e);
    }
  }

  const yearsRemaining =
    retirementAge - currentAge;

  const progress = Math.min(
    100,
    (currentSavings / targetCorpus) * 100
  );

  const icon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v20" />
      <path d="m17 5-5-3-5 3" />
      <path d="m17 19-5 3-5-3" />
      <path d="M2 12h20" />
    </svg>
  );

  const headerRight = (
    <button
      className="view-details-btn"
      onClick={() =>
        navigate("/retirement-planner")
      }
    >
      View Details
    </button>
  );

  return (
    <DashboardCard
      title="Retirement Plan"
      icon={icon}
      iconBg="rgba(245,158,11,.12)"
      iconColor="#F59E0B"
      headerRight={headerRight}
      loading={loading}
      className="retirement-summary-card"
    >
      <div
        style={{
          padding: "22px",
        }}
      >
        {/* Top */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px",
            alignItems: "center",
            gap: "18px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#6B7280",
                fontWeight: "600",
              }}
            >
              Target Retirement Age
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "34px",
                fontWeight: "800",
                color: "#111827",
              }}
            >
              {retirementAge} Years
            </div>
          </div>

          <img
            src={retirementImage}
            alt="Retirement"
            style={{
              width: "160px",
              height: "105px",
              objectFit: "cover",
              borderRadius: "16px",
              boxShadow:
                "0 12px 30px rgba(0,0,0,.18)",
            }}
          />
        </div>

        {/* Time Remaining */}
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#6B7280",
              fontWeight: "600",
            }}
          >
            Time Remaining
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "28px",
              color: "#4F46E5",
              fontWeight: "800",
            }}
          >
            {yearsRemaining} Y : 00 M : 00 D
          </div>
        </div>

        {/* Corpus */}
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#6B7280",
              fontWeight: "600",
            }}
          >
            Retirement Corpus
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "24px",
              fontWeight: "700",
            }}
          >
            <span
              style={{
                color: "#111827",
              }}
            >
              {fmt(currentSavings)}
            </span>

            <span
              style={{
                color: "#6B7280",
                fontWeight: "500",
              }}
            >
              {" "}
              / {fmt(targetCorpus)}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            width: "100%",
            height: "10px",
            background: "#E5E7EB",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background:
                "linear-gradient(90deg,#6366F1,#8B5CF6)",
              borderRadius: "999px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "10px",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          <span
            style={{
              color: "#6B7280",
            }}
          >
            Progress
          </span>

          <span
            style={{
              color: "#4F46E5",
            }}
          >
            {progress.toFixed(0)}%
          </span>
        </div>
      </div>
    </DashboardCard>
  );
}