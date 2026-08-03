package com.financeplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParsedTransactionDto {
    private LocalDate date;
    private String description;
    private Double debitAmount;
    private Double creditAmount;
    private Double balance;
}
