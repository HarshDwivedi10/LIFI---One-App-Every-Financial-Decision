package com.financeplanner.service;

import com.financeplanner.entity.Asset;
import com.financeplanner.entity.FixedExpense;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.FixedExpenseRepository;
import com.financeplanner.repository.TransactionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FixedExpenseAdjustmentService {

    private final TransactionRepository transactionRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final AssetRepository assetRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void adjustFixedExpensesForDateChange(User user, int newSalaryDay) {
        LocalDate today = LocalDate.now();
        
        List<Transaction> txns = transactionRepository.findByUserId(user.getId());
        Transaction savingsDeposit = txns.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.CREDIT
                        && "Automated Savings Deposit".equals(t.getDescription())
                        && t.getDate().getMonth() == today.getMonth()
                        && t.getDate().getYear() == today.getYear())
                .findFirst().orElse(null);

        if (today.getDayOfMonth() >= newSalaryDay) {
            if (savingsDeposit == null) {
                log.info("Salary day changed to past/present day {}. Processing fixed expenses for user {}", newSalaryDay, user.getEmail());
                processCycle(user, today, txns);
            }
        } else {
            if (savingsDeposit != null) {
                log.info("Salary day changed to future day {}. Reversing fixed expenses for user {}", newSalaryDay, user.getEmail());
                reverseCycle(user, today, txns, savingsDeposit);
            }
        }
    }

    private void processCycle(User user, LocalDate today, List<Transaction> txns) {
        List<FixedExpense> fixedExpenses = fixedExpenseRepository.findByUserId(user.getId());
        double totalFixedExp = 0;
        for (FixedExpense fixedExp : fixedExpenses) {
            Transaction expTxn = new Transaction();
            expTxn.setUser(user);
            expTxn.setType(Transaction.TransactionType.EXPENSE);
            expTxn.setCategory(fixedExp.getCategory());
            expTxn.setDescription(fixedExp.getDescription());
            expTxn.setAmount(fixedExp.getAmount());
            expTxn.setDate(today);
            expTxn.setFixedExpenseId(fixedExp.getId());
            transactionRepository.save(expTxn);
            totalFixedExp += fixedExp.getAmount();
        }

        double currentMonthIncome = txns.stream()
                .filter(t -> (t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                .mapToDouble(Transaction::getAmount)
                .sum();
        
        double currentMonthExpenses = txns.stream()
                .filter(t -> (t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                .mapToDouble(Transaction::getAmount)
                .sum() + totalFixedExp; 

        double projectedSavings = currentMonthIncome - currentMonthExpenses;
        
        if (projectedSavings > 0) {
            applySavingsDistribution(user, projectedSavings, false);
            
            Transaction record = new Transaction();
            record.setUser(user);
            record.setType(Transaction.TransactionType.CREDIT);
            record.setAmount(projectedSavings);
            record.setCategory("Savings");
            record.setDescription("Automated Savings Deposit");
            record.setDate(today);
            transactionRepository.save(record);
        }
    }

    private void reverseCycle(User user, LocalDate today, List<Transaction> txns, Transaction savingsDeposit) {
        List<Transaction> fixedExpTxns = txns.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE 
                        && t.getFixedExpenseId() != null
                        && t.getDate().getMonth() == today.getMonth()
                        && t.getDate().getYear() == today.getYear())
                .collect(Collectors.toList());
        transactionRepository.deleteAll(fixedExpTxns);

        if (savingsDeposit.getAmount() > 0) {
            applySavingsDistribution(user, savingsDeposit.getAmount(), true);
        }
        transactionRepository.delete(savingsDeposit);
    }

    private void applySavingsDistribution(User user, double amount, boolean reverse) {
        try {
            if (user.getFundAllocationsJson() != null && !user.getFundAllocationsJson().isEmpty() && !user.getFundAllocationsJson().equals("{}")) {
                JsonNode json = objectMapper.readTree(user.getFundAllocationsJson());
                JsonNode core = json.get("core");
                double retirementPct = json.has("retirement") ? json.get("retirement").asDouble() : 0;
                
                List<Asset> assets = assetRepository.findByUserId(user.getId());
                
                if (retirementPct > 0) {
                    Asset ret = assets.stream().filter(a -> "RETIREMENT".equals(a.getAssetType())).findFirst().orElse(null);
                    if (ret != null) {
                        double val = amount * (retirementPct / 100.0);
                        ret.setCurrentValue(ret.getCurrentValue() + (reverse ? -val : val));
                        assetRepository.save(ret);
                    }
                }
                
                if (core != null) {
                    core.fields().forEachRemaining(entry -> {
                        String fundId = entry.getKey();
                        double pct = entry.getValue().asDouble();
                        if (pct > 0) {
                            Asset fund = assets.stream().filter(a -> fundId.equals(a.getAssetType())).findFirst().orElse(null);
                            if (fund != null) {
                                double val = amount * (pct / 100.0);
                                fund.setCurrentValue(fund.getCurrentValue() + (reverse ? -val : val));
                                assetRepository.save(fund);
                            }
                        }
                    });
                }
            }
        } catch (Exception e) {
            log.error("Failed to apply/reverse savings distribution for user {}", user.getId(), e);
        }
    }
}
