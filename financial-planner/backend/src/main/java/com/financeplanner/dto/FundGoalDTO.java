package com.financeplanner.dto;

import lombok.Data;

@Data
public class FundGoalDTO {
    private Double targetAmount;
    private String targetDate;           // "YYYY-MM-DD"
    private Double expectedMonthlySavings;
    private Double alreadyAllocatedPct;  // sum of all existing fund percentages
}
