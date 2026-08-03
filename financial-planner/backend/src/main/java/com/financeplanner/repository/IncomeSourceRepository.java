package com.financeplanner.repository;

import com.financeplanner.entity.IncomeSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IncomeSourceRepository extends JpaRepository<IncomeSource, Long> {
    java.util.List<IncomeSource> findByUserId(Long userId);
}
