package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "retirement_plans")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RetirementPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String mode; // MODE1

    private Integer currentAge;
    private Integer retirementAge;
    private Double currentRetirementSavings;
    private Double monthlyIncome;

    // Assumptions
    private Double inflationRate;
    private Double expectedReturn;
    private Double withdrawalRate;
    private Double lifestyleRatio;
    private Double salaryIncreaseRate;

    // Mode-specific inputs
    private Double currentMonthlyExpense;
    private Double currentMonthlyContribution; // For Optimizer mode

    /**
     * Calculated results stored as JSON
     */
    @Column(columnDefinition = "TEXT")
    private String resultJson;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
