package com.financeplanner.service;

import com.financeplanner.entity.BankTransaction;
import com.financeplanner.repository.BankTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TransactionService {

    private final BankTransactionRepository repository;

    public TransactionService(BankTransactionRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void saveParsedTransaction(BankTransaction transaction) {
        // Prevent saving duplicate transactions by checking messageId
        if (transaction.getMessageId() != null && repository.existsByMessageId(transaction.getMessageId())) {
            return; // Already processed this email
        }
        
        repository.save(transaction);
    }
    
    public List<BankTransaction> getUserTransactions(Long userId) {
        return repository.findByUserId(userId);
    }
}
