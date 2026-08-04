package com.financeplanner.repository;

import com.financeplanner.entity.FixedExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FixedExpenseRepository extends JpaRepository<FixedExpense, Long> {
    List<FixedExpense> findByUserId(Long userId);
}
