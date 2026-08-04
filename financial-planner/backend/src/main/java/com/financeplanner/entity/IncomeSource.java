package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "income_sources")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncomeSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IncomeType type;

    @Column(nullable = false)
    private Double amount;

    private String description;

    /**
     * Day of the month this income arrives (1-31).
     * e.g. salary on 10th, freelance on 12th.
     */
    @Column(name = "day_of_month")
    private Integer dayOfMonth = 1;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public enum IncomeType {
        SALARY, FREELANCE, BUSINESS, RENTAL, DIVIDEND, OTHER
    }
}
