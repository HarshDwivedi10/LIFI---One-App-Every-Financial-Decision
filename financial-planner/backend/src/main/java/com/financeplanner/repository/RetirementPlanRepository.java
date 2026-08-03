package com.financeplanner.repository;

import com.financeplanner.entity.RetirementPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface RetirementPlanRepository extends JpaRepository<RetirementPlan, Long> {
    Optional<RetirementPlan> findTopByUserIdOrderByUpdatedAtDesc(Long userId);
}
