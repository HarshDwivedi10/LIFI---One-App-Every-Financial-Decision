package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "salary_day")
    private Integer salaryDay;

    @Column(name = "salary_time")
    private String salaryTime;

    @Column(name = "manual_total_savings")
    private Double manualTotalSavings;

    @Column(name = "pre_existing_savings_date")
    private String preExistingSavingsDate;

    @Column(name = "fund_allocations_json", columnDefinition = "TEXT")
    private String fundAllocationsJson;

    private String name;

    @Column(name = "phone_number")
    private String phone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_coach_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User assignedCoach;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Enumerated(EnumType.STRING)
    private AccountStatus status;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    // --- UserDetails Methods ---

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role != null ? role.name() : Role.ROLE_USER.name()));
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == null || status == AccountStatus.ACTIVE;
    }

    /**
     * Returns true if the account is in a non-loginable state
     * (PENDING, SUSPENDED, or REJECTED).
     */
    public boolean isBlocked() {
        return status == AccountStatus.PENDING
                || status == AccountStatus.SUSPENDED
                || status == AccountStatus.REJECTED;
    }
}
