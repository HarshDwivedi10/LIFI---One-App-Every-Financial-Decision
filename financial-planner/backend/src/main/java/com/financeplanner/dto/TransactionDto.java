package com.financeplanner.dto;

import com.financeplanner.entity.BankTransaction.TransactionType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TransactionDto {
    private Long id;
    private BigDecimal transactionAmount;
    private TransactionType transactionType;
    private String accountNumber;
    private BigDecimal availableBalance;
    private String merchantName;
    private LocalDateTime transactionDate;
    private String referenceNumber;
    private String bankName;
}
