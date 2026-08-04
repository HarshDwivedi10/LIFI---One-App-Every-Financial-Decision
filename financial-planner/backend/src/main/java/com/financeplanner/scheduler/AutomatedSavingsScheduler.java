package com.financeplanner.scheduler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeplanner.entity.Asset;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.NotificationRepository;
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
    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    // Run every minute to support exact time precision
    @Scheduled(cron = "0 * * * * ?")
    @Transactional
    public void executeAutomatedSavings() {
        log.info("Starting automated savings check...");
        List<User> users = userRepository.findAll();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        for (User user : users) {
            try {
                int targetHour = 0;
                int targetMinute = 0;
                if (user.getSalaryTime() != null && !user.getSalaryTime().isEmpty()) {
                    try {
                        String[] timeParts = user.getSalaryTime().split(":");
                        targetHour = Integer.parseInt(timeParts[0]);
                        targetMinute = Integer.parseInt(timeParts[1]);
                    } catch (Exception e) {}
                }
                
                boolean isPastTime = false;
                if (user.getSalaryDay() != null) {
                    if (today.getDayOfMonth() > user.getSalaryDay()) {
                        isPastTime = true;
                    } else if (today.getDayOfMonth() == user.getSalaryDay()) {
                        if (now.getHour() > targetHour || (now.getHour() == targetHour && now.getMinute() >= targetMinute)) {
                            isPastTime = true;
                        }
                    }
                }
                
                if (isPastTime) {
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

                    // The user's manual base income (repurposed from manualTotalSavings) or actual tracked income.
                    double baseIncomeForDistribution = (user.getManualTotalSavings() != null && user.getManualTotalSavings() > 0) 
                            ? user.getManualTotalSavings() 
                            : currentMonthIncome;
                    
                    double projectedSavings = currentMonthIncome - currentMonthExpenses;
                    
                    // We only distribute if they actually have projected savings, or maybe they just want the disciplined approach.
                    // The user wants: "har mahine itni amount on the salary day will be added to this fund"
                    // If they have positive income, we execute the distribution.
                    if (baseIncomeForDistribution > 0) {
                        log.info("Applying automated savings for user {}: Base Income = {}", user.getEmail(), baseIncomeForDistribution);
                        
                        // We do NOT add projectedSavings to manualTotalSavings anymore since it now represents Monthly Income.
                        
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
                                    ret.setCurrentValue(ret.getCurrentValue() + (baseIncomeForDistribution * (retirementPct / 100.0)));
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
                                            fund.setCurrentValue(fund.getCurrentValue() + (baseIncomeForDistribution * (pct / 100.0)));
                                            assetRepository.save(fund);
                                        }
                                    }
                                });
                            }
                        }
                        
                        userRepository.save(user);

                        // Record the transaction to prevent duplicate processing
                        // We will record the total amount saved as a transaction
                        double totalSaved = 0;
                        if (user.getFundAllocationsJson() != null && !user.getFundAllocationsJson().isEmpty() && !user.getFundAllocationsJson().equals("{}")) {
                            JsonNode json = objectMapper.readTree(user.getFundAllocationsJson());
                            JsonNode core = json.get("core");
                            double retirementPct = json.has("retirement") ? json.get("retirement").asDouble() : 0;
                            double corePct = 0;
                            if (core != null) {
                                for (JsonNode node : core) {
                                    corePct += node.asDouble();
                                }
                            }
                            totalSaved = baseIncomeForDistribution * ((retirementPct + corePct) / 100.0);
                        }
                        
                        Transaction record = new Transaction();
                        record.setUser(user);
                        record.setType(Transaction.TransactionType.CREDIT);
                        record.setAmount(totalSaved > 0 ? totalSaved : projectedSavings);
                        record.setCategory("Savings");
                        record.setDescription("Automated Savings Deposit");
                        record.setDate(today);
                        transactionRepository.save(record);

                        com.financeplanner.entity.Notification notification = new com.financeplanner.entity.Notification();
                        notification.setUserId(user.getId());
                        notification.setType("STATEMENT_VERIFICATION");
                        notification.setContent("Your new savings cycle has started. Please verify last month's exact savings by uploading your bank statement in the Expense Management dashboard.");
                        notificationRepository.save(notification);
                    }

                }
            } catch (Exception e) {
                log.error("Failed to process automated savings for user {}", user.getId(), e);
            }
        }
    }
}
