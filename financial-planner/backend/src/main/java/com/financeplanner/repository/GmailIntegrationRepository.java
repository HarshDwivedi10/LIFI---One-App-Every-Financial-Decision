package com.financeplanner.repository;

import com.financeplanner.entity.GmailIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GmailIntegrationRepository extends JpaRepository<GmailIntegration, Long> {
    Optional<GmailIntegration> findByUserId(Long userId);
}
