package com.financeplanner.repository;

import com.financeplanner.entity.Goal;
import com.financeplanner.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByUser(User user);
    List<Goal> findByUserId(Long userId);
    long countByUserId(Long userId);
}
