package com.financeplanner.repository;

import com.financeplanner.entity.MonthlyStatementVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MonthlyStatementVerificationRepository extends JpaRepository<MonthlyStatementVerification, Long> {
    Optional<MonthlyStatementVerification> findByUserIdAndYearAndMonth(Long userId, int year, int month);
    List<MonthlyStatementVerification> findByUserId(Long userId);
}
