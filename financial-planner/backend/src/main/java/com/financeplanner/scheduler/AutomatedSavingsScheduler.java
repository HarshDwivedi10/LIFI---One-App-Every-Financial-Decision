package com.financeplanner.scheduler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeplanner.entity.Asset;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.TransactionRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AutomatedSavingsScheduler {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final AssetRepository assetRepository;
    private final ObjectMapper objectMapper;

    // Run every day at 1:00 AM server time
    @Scheduled(cron = "0 0 1 * * ?")
    @Transactional
    public void executeAutomatedSavings() {
        log.info("Starting daily automated savings check...");
        List<User> users = userRepository.findAll();
        LocalDate today = LocalDate.now();

        for (User user : users) {
            try {
                if (user.getSalaryDay() != null && today.getDayOfMonth() >= user.getSalaryDay()) {
                    // Check if already processed this month
                    // For this mockup, we'll assume it processes once per month.
                    // We need a way to track last processed date. Since we didn't add it to User,
                    // we'll skip the "lastProcessedDate" check in this simple mockup, or implement a naive check.
                    // Actually, if we run this every day, we MUST prevent double applying.
                    // We can check if a specific "Automated Deposit" transaction exists for this month.
                    
                    boolean alreadyProcessed = transactionRepository.findByUserId(user.getId()).stream()
                            .anyMatch(t -> t.getType() == Transaction.TransactionType.CREDIT 
                                    && "Automated Savings Deposit".equals(t.getDescription())
                                    && t.getDate().getMonth() == today.getMonth()
                                    && t.getDate().getYear() == today.getYear());
                    
                    if (alreadyProcessed) {
                        continue;
                    }

                    // 1. Calculate Monthly Net Savings (simplified to track all recent non-automated)
                    // For a robust system, we would take regular income - regular expenses.
                    // Here we'll take the current month's transactions up to today.
                    List<Transaction> txns = transactionRepository.findByUserId(user.getId());
                    double currentMonthIncome = txns.stream()
                            .filter(t -> (t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                            .mapToDouble(Transaction::getAmount)
                            .sum();
                    
                    double currentMonthExpenses = txns.stream()
                            .filter(t -> (t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                            .mapToDouble(Transaction::getAmount)
                            .sum();

                    // Include base salary if it exists in Income sources (we don't have direct access here easily without IncomeRepository, assuming transactions reflect it)
                    // For this mockup, let's just use a fixed 10000 or derive it.
                    // Actually, let's just distribute what they have in manualTotalSavings if it's > 0, otherwise skip.
                    // Wait, the user wants to ADD the savings.
                    double projectedSavings = currentMonthIncome - currentMonthExpenses;
                    
                    if (projectedSavings > 0) {
                        log.info("Applying automated savings for user {}: {}", user.getEmail(), projectedSavings);
                        
                        // Add to manualTotalSavings
                        double newTotal = (user.getManualTotalSavings() != null ? user.getManualTotalSavings() : 0.0) + projectedSavings;
                        user.setManualTotalSavings(newTotal);
                        
                        // Distribute to funds based on JSON
                        if (user.getFundAllocationsJson() != null && !user.getFundAllocationsJson().isEmpty() && !user.getFundAllocationsJson().equals("{}")) {
                            JsonNode json = objectMapper.readTree(user.getFundAllocationsJson());
                            JsonNode core = json.get("core");
                            double retirementPct = json.has("retirement") ? json.get("retirement").asDouble() : 0;
                            
                            List<Asset> assets = assetRepository.findByUserId(user.getId());
                            
                            // Apply retirement
                            if (retirementPct > 0) {
                                Asset ret = assets.stream().filter(a -> a.getAssetType().equals("RETIREMENT")).findFirst().orElse(null);
                                if (ret != null) {
                                    ret.setCurrentValue(ret.getCurrentValue() + (projectedSavings * (retirementPct / 100.0)));
                                    assetRepository.save(ret);
                                }
                            }
                            
                            // Apply core
                            if (core != null) {
                                core.fields().forEachRemaining(entry -> {
                                    String fundId = entry.getKey();
                                    double pct = entry.getValue().asDouble();
                                    if (pct > 0) {
                                        Asset fund = assets.stream().filter(a -> a.getAssetType().equals(fundId)).findFirst().orElse(null);
                                        if (fund != null) {
                                            fund.setCurrentValue(fund.getCurrentValue() + (projectedSavings * (pct / 100.0)));
                                            assetRepository.save(fund);
                                        }
                                    }
                                });
                            }
                        }
                        
                        userRepository.save(user);

                        // Record the transaction to prevent duplicate processing
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
            } catch (Exception e) {
                log.error("Failed to process automated savings for user {}", user.getId(), e);
            }
        }
    }
}
