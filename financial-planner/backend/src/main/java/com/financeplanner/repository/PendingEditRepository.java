package com.financeplanner.repository;

import com.financeplanner.entity.PendingEdit;
import com.financeplanner.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PendingEditRepository extends JpaRepository<PendingEdit, Long> {
    List<PendingEdit> findByUserAndStatusOrderByCreatedAtDesc(User user, String status);
    List<PendingEdit> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
}
