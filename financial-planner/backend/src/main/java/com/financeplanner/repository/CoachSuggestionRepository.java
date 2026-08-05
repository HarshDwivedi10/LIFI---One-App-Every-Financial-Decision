package com.financeplanner.repository;

import com.financeplanner.entity.CoachSuggestion;
import com.financeplanner.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CoachSuggestionRepository extends JpaRepository<CoachSuggestion, Long> {
    List<CoachSuggestion> findByUserOrderByCreatedAtDesc(User user);
    List<CoachSuggestion> findByUserIdOrderByCreatedAtDesc(Long userId);
}
