package com.financeplanner.repository;

import com.financeplanner.entity.BankTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BankTransactionRepository extends JpaRepository<BankTransaction, Long> {
    List<BankTransaction> findByUserId(Long userId);
    Optional<BankTransaction> findByMessageId(String messageId);
    boolean existsByMessageId(String messageId);
}
