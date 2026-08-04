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

    @Autowired
    private com.financeplanner.repository.MonthlyStatementVerificationRepository verificationRepository;

    @Autowired
    private com.financeplanner.repository.UserRepository userRepository;

    public Map<String, Object> executeVerification(User user, com.financeplanner.dto.VerificationRequestDto req) {
        Map<String, Object> result = new HashMap<>();
        
        // 1. Calculate Projected Savings for the month
        List<IncomeSource> incomeSources = incomeSourceRepository.findByUserId(user.getId());
        double projectedIncome = incomeSources.stream().mapToDouble(IncomeSource::getAmount).sum();
        
        LocalDate startOfMonth = LocalDate.of(req.getYear(), req.getMonth(), 1);
        LocalDate endOfMonth = startOfMonth.plusMonths(1).minusDays(1);
        
        List<Transaction> monthTransactions = transactionRepository.findByUserId(user.getId()).stream()
                .filter(t -> !t.getDate().isBefore(startOfMonth) && !t.getDate().isAfter(endOfMonth))
                .collect(Collectors.toList());
                
        double manualExpenses = monthTransactions.stream()
                .filter(t -> "EXPENSE".equals(t.getType()) || "DEBIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount)
                .sum();
                
        double projectedSavings = Math.max(0, projectedIncome - manualExpenses);
        
        // 2. Calculate Actual Savings based on user-verified inputs
        double actualSavings = Math.max(0, req.getVerifiedIncome() - req.getVerifiedExpense());
        
        // 3. Find Total Deficit (if they saved less than projected)
        double totalDeficit = projectedSavings - actualSavings;
        if (totalDeficit < 0) totalDeficit = 0; // if they saved more, no deficit penalty
        
        // 4. Fetch or Create Verification Record
        MonthlyStatementVerification verification = verificationRepository
                .findByUserIdAndYearAndMonth(user.getId(), req.getYear(), req.getMonth())
                .orElseGet(() -> MonthlyStatementVerification.builder()
                        .user(user)
                        .year(req.getYear())
                        .month(req.getMonth())
                        .csvIncome(req.getCsvIncome())
                        .csvExpense(req.getCsvExpense())
                        .appliedDeficit(0.0)
                        .build());
                        
        verification.setVerifiedIncome(req.getVerifiedIncome());
        verification.setVerifiedExpense(req.getVerifiedExpense());
        verification.setVerified(true);
        
        double previousAppliedDeficit = verification.getAppliedDeficit();
        double deltaDeficit = totalDeficit - previousAppliedDeficit;
        
        verification.setAppliedDeficit(totalDeficit);
        verificationRepository.save(verification);
        
        result.put("projectedSavings", projectedSavings);
        result.put("actualSavings", actualSavings);
        result.put("totalDeficit", totalDeficit);
        result.put("deltaDeficit", deltaDeficit);
        
        if (deltaDeficit == 0) {
            result.put("message", "Savings verified. No further fund adjustments needed.");
            return result;
        }

        // 5. (Removed) We no longer manually modify the User's base savings, 
        // because the global Live Total Savings is computed dynamically and 
        // will naturally incorporate this Verification record.
        
        // 6. Adjust Funds (Assets) by the delta
        List<Asset> userAssets = assetRepository.findByUserId(user.getId());
        double totalWealth = userAssets.stream().mapToDouble(Asset::getCurrentValue).sum();
        
        if (totalWealth > 0 && deltaDeficit != 0) {
            for (Asset asset : userAssets) {
                double proportion = asset.getCurrentValue() / totalWealth;
                double adjustment = deltaDeficit * proportion;
                
                double newValue = Math.max(0, asset.getCurrentValue() - adjustment);
                asset.setCurrentValue(newValue);
                assetRepository.save(asset);
            }
            result.put("fundsAdjusted", true);
        } else {
            result.put("fundsAdjusted", false);
        }
        
        // 7. Evaluate Goals and Push Target Dates if there's a positive deficit
        int delayedGoalsCount = 0;
        if (deltaDeficit > 0) {
            List<Goal> userGoals = goalRepository.findByUserId(user.getId());
            for (Goal goal : userGoals) {
                Asset mappedCorpus = userAssets.stream()
                        .filter(a -> a.getAssetType() != null && (a.getAssetType().equals(goal.getCategory()) || a.getAssetType().contains(goal.getCategory().replace("_", " "))))
                        .findFirst()
                        .orElse(null);
                        
                if (mappedCorpus != null && goal.getMonthlyAllocation() != null && goal.getMonthlyAllocation() > 0) {
                    long currentMonthsRemaining = ChronoUnit.MONTHS.between(LocalDate.now(), goal.getTargetDate());
                    if (currentMonthsRemaining <= 0) currentMonthsRemaining = 1;
                    
                    double projectedBalanceByTarget = mappedCorpus.getCurrentValue() + (goal.getMonthlyAllocation() * currentMonthsRemaining);
                    
                    if (projectedBalanceByTarget < goal.getCost()) {
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
        }
        result.put("delayedGoalsCount", delayedGoalsCount);
        
        return result;
    }
}
