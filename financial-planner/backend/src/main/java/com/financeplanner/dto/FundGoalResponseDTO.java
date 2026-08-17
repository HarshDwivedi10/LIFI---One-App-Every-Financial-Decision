package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FundGoalResponseDTO {
    private long    monthsRemaining;           // months from today to targetDate
    private double  requiredMonthlyContrib;    // ceil(targetAmount / monthsRemaining)
    private double  requiredPct;               // % of monthly savings needed
    private double  suggestedPct;              // min(requiredPct, remainingPct)  — auto-set value
    private double  remainingMonthlySavings;   // savings available after existing allocations
    private double  remainingPct;              // 100 - alreadyAllocatedPct
    private boolean feasible;

    // Populated only when NOT feasible
    private double  shortfallMonthly;          // requiredMonthlyContrib - remainingMonthlySavings
    private String  projectedDate;             // date achievable if all remaining savings allocated
    private long    projectedMonths;           // months needed with all remaining savings
}
