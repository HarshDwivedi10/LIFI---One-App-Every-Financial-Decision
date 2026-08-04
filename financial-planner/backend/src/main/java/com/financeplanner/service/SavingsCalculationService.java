package com.financeplanner.service;

import com.financeplanner.entity.MonthlyStatementVerification;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.MonthlyStatementVerificationRepository;
import com.financeplanner.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SavingsCalculationService {

    private final TransactionRepository transactionRepository;
    private final MonthlyStatementVerificationRepository verificationRepository;

    public double calculateLiveTotalSavings(User user) {
        double liveSavings = user.getManualTotalSavings() != null ? user.getManualTotalSavings() : 0.0;

        List<MonthlyStatementVerification> verifications = verificationRepository.findByUserId(user.getId());
        for (MonthlyStatementVerification v : verifications) {
            liveSavings += (v.getVerifiedIncome() - v.getVerifiedExpense());
        }

        List<Transaction> txns = transactionRepository.findByUserId(user.getId());
        for (Transaction t : txns) {
            boolean isVerified = verifications.stream().anyMatch(v -> 
                v.getMonth() == t.getDate().getMonthValue() && v.getYear() == t.getDate().getYear()
            );

            if (!isVerified) {
                if (t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT) {
                    liveSavings += t.getAmount();
                } else if (t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT) {
                    liveSavings -= t.getAmount();
                }
            }
        }

        return liveSavings;
    }
}
