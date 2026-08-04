package com.financeplanner.dto;

import lombok.Data;

@Data
public class VerificationRequestDto {
    private int year;
    private int month;
    private double verifiedIncome;
    private double verifiedExpense;
    private double csvIncome;
    private double csvExpense;
}
