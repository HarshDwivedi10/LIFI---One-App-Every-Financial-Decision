package com.financeplanner.repository;

import com.financeplanner.entity.IncomeSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IncomeSourceRepository extends JpaRepository<IncomeSource, Long> {
    java.util.List<IncomeSource> findByUserId(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(i.amount), 0) FROM IncomeSource i WHERE i.user.id = :userId")
    Double sumIncomeByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);
}
