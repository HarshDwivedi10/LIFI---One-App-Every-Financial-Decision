package com.financeplanner.service;

import com.financeplanner.entity.*;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.GoalRepository;
import com.financeplanner.repository.IncomeSourceRepository;
import com.financeplanner.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReconciliationService {

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private IncomeSourceRepository incomeSourceRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    public Map<String, Object> reconcileMonth(User user, List<Transaction> uploadedTransactions) {
        Map<String, Object> result = new HashMap<>();
        
        // 1. Calculate Projected Savings
        List<IncomeSource> incomeSources = incomeSourceRepository.findByUserId(user.getId());
        double projectedIncome = incomeSources.stream().mapToDouble(IncomeSource::getAmount).sum();
        
        // Fetch user's fixed/recurring expenses for the month to calculate projected savings
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate endOfMonth = startOfMonth.plusMonths(1).minusDays(1);
        
        List<Transaction> monthTransactions = transactionRepository.findByUserId(user.getId()).stream()
                .filter(t -> !t.getDate().isBefore(startOfMonth) && !t.getDate().isAfter(endOfMonth))
                .collect(Collectors.toList());
                
        double fixedExpenses = monthTransactions.stream()
                .filter(t -> "EXPENSE".equals(t.getType()) || "DEBIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount)
                .sum();
                
        double projectedSavings = Math.max(0, projectedIncome - fixedExpenses);
        
        // 2. Calculate Actual Savings from uploaded statement
        double actualIncome = uploadedTransactions.stream()
                .filter(t -> "INCOME".equals(t.getType()) || "CREDIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount)
                .sum();
                
        double actualExpenses = uploadedTransactions.stream()
                .filter(t -> "EXPENSE".equals(t.getType()) || "DEBIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount)
                .sum();
                
        double actualSavings = Math.max(0, actualIncome - actualExpenses);
        
        // 3. Find Deficit
        double deficit = projectedSavings - actualSavings;
        result.put("projectedSavings", projectedSavings);
        result.put("actualSavings", actualSavings);
        result.put("deficit", deficit);
        
        if (deficit <= 0) {
            result.put("message", "Savings are on track or higher than expected. No negative adjustments needed.");
            return result;
        }
        
        // 4. Adjust Funds (Assets)
        List<Asset> userAssets = assetRepository.findByUserId(user.getId());
        
        // Calculate total current wealth to proportionally distribute the deficit
        double totalWealth = userAssets.stream().mapToDouble(Asset::getCurrentValue).sum();
        
        if (totalWealth > 0) {
            for (Asset asset : userAssets) {
                double proportion = asset.getCurrentValue() / totalWealth;
                double reductionAmount = deficit * proportion;
                
                double newValue = Math.max(0, asset.getCurrentValue() - reductionAmount);
                asset.setCurrentValue(newValue);
                assetRepository.save(asset);
            }
            result.put("fundsAdjusted", true);
        } else {
            result.put("fundsAdjusted", false);
        }
        
        // 5. Evaluate Goals and Push Target Dates
        List<Goal> userGoals = goalRepository.findByUserId(user.getId());
        int delayedGoalsCount = 0;
        
        for (Goal goal : userGoals) {
            // Find the corpus mapped to this goal
            Asset mappedCorpus = userAssets.stream()
                    .filter(a -> a.getAssetType() != null && (a.getAssetType().equals(goal.getCategory()) || a.getAssetType().contains(goal.getCategory().replace("_", " "))))
                    .findFirst()
                    .orElse(null);
                    
            if (mappedCorpus != null && goal.getMonthlyAllocation() != null && goal.getMonthlyAllocation() > 0) {
                // Determine months remaining
                long currentMonthsRemaining = ChronoUnit.MONTHS.between(LocalDate.now(), goal.getTargetDate());
                if (currentMonthsRemaining <= 0) currentMonthsRemaining = 1;
                
                double projectedBalanceByTarget = mappedCorpus.getCurrentValue() + (goal.getMonthlyAllocation() * currentMonthsRemaining);
                
                if (projectedBalanceByTarget < goal.getCost()) {
                    // Off-track due to corpus deduction! Calculate new target date
                    double shortfall = goal.getCost() - projectedBalanceByTarget;
                    int extraMonthsNeeded = (int) Math.ceil(shortfall / goal.getMonthlyAllocation());
                    
                    if (extraMonthsNeeded > 0) {
                        goal.setTargetDate(goal.getTargetDate().plusMonths(extraMonthsNeeded));
                        goal.setIsDelayed(true);
                        goal.setAcknowledged(false);
                        goalRepository.save(goal);
                        delayedGoalsCount++;
                    }
                }
            }
        }
        
        result.put("delayedGoalsCount", delayedGoalsCount);
        
        return result;
    }
}
