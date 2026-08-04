package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Entity
@Table(name = "monthly_statement_verifications", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "month", "year"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyStatementVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private int month; // 1-12
    private int year;

    // Parsed from CSV initially
    private double csvIncome;
    private double csvExpense;

    // Finally verified by user
    private double verifiedIncome;
    private double verifiedExpense;

    // How much deficit was applied to the user's funds & total savings for this month
    // We store this to compute deltas if they verify again later.
    private double appliedDeficit;

    private boolean isVerified;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
