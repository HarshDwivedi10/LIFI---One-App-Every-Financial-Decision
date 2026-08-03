package com.financeplanner.dto;

import com.financeplanner.entity.Goal.Priority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoalSimulationRequest {
    private SimulationType type;

    // For New/Update Goal
    private Long goalId; // If updating
    private String name;
    private Double cost;
    private String category;
    private LocalDate targetDate;
    private Double monthlyAllocation;
    private Priority priority;

    // For One-Time Purchase
    private Double purchaseAmount;

    // For Salary Change
    private Double newSalary;

    // For Monthly Savings Change
    private Double newMonthlySavings;

    // For Retirement Age Change
    private Integer newRetirementAge;

    public enum SimulationType {
        NEW_GOAL,
        UPDATE_GOAL,
        DELETE_GOAL,
        ONE_TIME_PURCHASE,
        SALARY_CHANGE,
        SAVINGS_CHANGE,
        RETIREMENT_AGE_CHANGE
    }
}
