package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bank_transactions")
@Data
public class BankTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    private User user;

    private BigDecimal transactionAmount;

    @Enumerated(EnumType.STRING)
    private TransactionType transactionType;

    private String accountNumber;
    
    private BigDecimal availableBalance;
    
    private String merchantName;
    
    private LocalDateTime transactionDate;
    
    private String referenceNumber;
    
    private String bankName;
    
    @Column(unique = true)
    private String messageId;

    public enum TransactionType {
        DEBIT, CREDIT
    }
}
