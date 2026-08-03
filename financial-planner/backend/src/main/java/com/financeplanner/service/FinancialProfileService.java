package com.financeplanner.service;

import com.financeplanner.entity.*;
import com.financeplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FinancialProfileService {

    private final IncomeSourceRepository incomeRepo;
    private final TransactionRepository txnRepo;
    private final AssetRepository assetRepo;

    public Map<String, Object> getFinancialSummary(Long userId) {
        List<IncomeSource> incomeSources = incomeRepo.findByUserId(userId);
        List<Transaction> transactions = txnRepo.findByUserId(userId);
        List<Asset> assets = assetRepo.findByUserId(userId);

        double totalMonthlyIncome = incomeSources.stream()
                .mapToDouble(IncomeSource::getAmount).sum();

        double totalExpenses = transactions.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE
                        || t.getType() == Transaction.TransactionType.DEBIT)
                .mapToDouble(Transaction::getAmount).sum();

        double totalCreditIncome = transactions.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.INCOME
                        || t.getType() == Transaction.TransactionType.CREDIT)
                .mapToDouble(Transaction::getAmount).sum();

        double totalAssets = assets.stream()
                .mapToDouble(Asset::getCurrentValue).sum();

        double netWorth = totalAssets;
        double availableSavings = totalMonthlyIncome - totalExpenses;

        return Map.of(
                "totalMonthlyIncome", totalMonthlyIncome,
                "totalExpenses", totalExpenses,
                "totalCreditIncome", totalCreditIncome,
                "totalAssets", totalAssets,
                "netWorth", netWorth,
                "availableMonthlySavings", availableSavings,
                "savingsRate", totalMonthlyIncome > 0 ? (availableSavings / totalMonthlyIncome) * 100 : 0
        );
    }
}
