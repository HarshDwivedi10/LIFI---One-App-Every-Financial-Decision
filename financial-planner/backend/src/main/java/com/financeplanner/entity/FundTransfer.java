package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "fund_transfers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String sourceFund;

    @Column(nullable = false)
    private String destinationFund;

    @Column(nullable = false)
    private Double amount;

    @Column(updatable = false)
    private LocalDateTime date;

    @PrePersist
    public void prePersist() {
        if (this.date == null) {
            this.date = LocalDateTime.now();
        }
    }
}
