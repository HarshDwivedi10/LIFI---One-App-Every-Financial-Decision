package com.financeplanner.scheduler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeplanner.entity.*;
import com.financeplanner.repository.*;
import com.financeplanner.service.SavingsCalculationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Iterator;

@Component
@RequiredArgsConstructor
@Slf4j
public class AutomatedSavingsScheduler {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final AssetRepository assetRepository;
    private final NotificationRepository notificationRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final IncomeSourceRepository incomeSourceRepository;
    private final ObjectMapper objectMapper;
    private final SavingsCalculationService savingsCalculationService;

    // Run automated savings scheduler (disabled minute cron to prevent double-incrementing asset balances)
    // @Scheduled(cron = "0 * * * * ?")
    @Transactional
    public void executeAutomatedSavings() {
        log.info("Starting automated savings check...");
        List<User> users = userRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        for (User user : users) {
            try {
                // -------------------------------------------------------------
                // 1. Process Income Sources (trigger on dayOfMonth)
                // -------------------------------------------------------------
                List<IncomeSource> incomeSources = incomeSourceRepository.findByUserId(user.getId());
                for (IncomeSource src : incomeSources) {
                    int arrDay = src.getDayOfMonth() != null ? src.getDayOfMonth() : 1;
                    if (today.getDayOfMonth() == arrDay) {
                        // Ensure we haven't already added this income for this month
                        boolean alreadyProcessed = transactionRepository.findByUserId(user.getId()).stream()
                                .anyMatch(t -> t.getType() == Transaction.TransactionType.INCOME 
                                        && src.getDescription().equals(t.getDescription())
                                        && t.getDate().getMonth() == today.getMonth()
                                        && t.getDate().getYear() == today.getYear());
                        
                        if (!alreadyProcessed) {
                            Transaction t = new Transaction();
                            t.setUser(user);
                            t.setType(Transaction.TransactionType.INCOME);
                            t.setCategory("Income");
                            t.setDescription(src.getDescription() != null ? src.getDescription() : src.getType().name());
                            t.setAmount(src.getAmount());
                            t.setDate(today);
                            t.setIncomeSourceId(src.getId());
                            transactionRepository.save(t);
                            log.info("Automated Income added for user {}: {}", user.getEmail(), src.getAmount());
                        }
                    }
                }

                // -------------------------------------------------------------
                // 2. Process Fixed Expenses & Savings Distribution (trigger on Salary Day & Time)
                // -------------------------------------------------------------
                int targetHour = 0;
                int targetMinute = 0;
                if (user.getSalaryTime() != null && !user.getSalaryTime().isEmpty()) {
                    try {
                        String[] timeParts = user.getSalaryTime().split(":");
                        targetHour = Integer.parseInt(timeParts[0]);
                        targetMinute = Integer.parseInt(timeParts[1]);
                    } catch (Exception e) {}
                }
                
                boolean isCycleStartReached = false;
                if (user.getSalaryDay() != null) {
                    if (today.getDayOfMonth() > user.getSalaryDay()) {
                        isCycleStartReached = true;
                    } else if (today.getDayOfMonth() == user.getSalaryDay()) {
                        if (now.getHour() > targetHour || (now.getHour() == targetHour && now.getMinute() >= targetMinute)) {
                            isCycleStartReached = true;
                        }
                    }
                }
                
                if (isCycleStartReached) {
                    // Check if already processed CYCLE START actions this month
                    boolean alreadyProcessed = transactionRepository.findByUserId(user.getId()).stream()
                            .anyMatch(t -> t.getType() == Transaction.TransactionType.CREDIT 
                                    && "Automated Savings Deposit".equals(t.getDescription())
                                    && t.getDate().getMonth() == today.getMonth()
                                    && t.getDate().getYear() == today.getYear());
                    
                    if (alreadyProcessed) {
                        continue;
                    }

                    // A) Add Fixed Expenses for the month
                    List<FixedExpense> fixedExpenses = fixedExpenseRepository.findByUserId(user.getId());
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
                    }

                    // B) Calculate Monthly Net Savings to Distribute to Funds
                    List<Transaction> txns = transactionRepository.findByUserId(user.getId());
                    double currentMonthIncome = txns.stream()
                            .filter(t -> (t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                            .mapToDouble(Transaction::getAmount)
                            .sum();
                    
                    double currentMonthExpenses = txns.stream()
                            .filter(t -> (t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT) && t.getDate().getMonth() == today.getMonth() && t.getDate().getYear() == today.getYear())
                            .mapToDouble(Transaction::getAmount)
                            .sum();

                    double projectedSavings = currentMonthIncome - currentMonthExpenses;
                    
                    if (projectedSavings > 0) {
                        log.info("Applying automated savings for user {}: Net Savings = {}", user.getEmail(), projectedSavings);
                        
                        // Distribute to funds based on JSON
                        if (user.getFundAllocationsJson() != null && !user.getFundAllocationsJson().isEmpty() && !user.getFundAllocationsJson().equals("{}")) {
                            JsonNode json = objectMapper.readTree(user.getFundAllocationsJson());
                            JsonNode core = json.get("core");
                            double retirementPct = json.has("retirement") ? json.get("retirement").asDouble() : 0;
                            
                            List<Asset> assets = assetRepository.findByUserId(user.getId());
                            double totalAllocatedPct = retirementPct;
                            
                            // Apply retirement
                            if (retirementPct > 0) {
                                Asset ret = assets.stream().filter(a -> "RETIREMENT".equals(a.getAssetType())).findFirst().orElse(null);
                                if (ret == null) {
                                    ret = Asset.builder().user(user).name("Retirement Corpus").assetType("RETIREMENT").currentValue(0.0).build();
                                }
                                ret.setCurrentValue(ret.getCurrentValue() + (projectedSavings * (retirementPct / 100.0)));
                                assetRepository.save(ret);
                            }
                            
                            // Apply core
                            if (core != null) {
                                Iterator<Map.Entry<String, JsonNode>> fields = core.fields();
                                while (fields.hasNext()) {
                                    Map.Entry<String, JsonNode> entry = fields.next();
                                    String fundId = entry.getKey();
                                    double pct = entry.getValue().asDouble();
                                    totalAllocatedPct += pct;
                                    if (pct > 0) {
                                        Asset fund = assets.stream().filter(a -> fundId.equals(a.getAssetType())).findFirst().orElse(null);
                                        if (fund == null) {
                                            fund = Asset.builder().user(user).name(fundId + " Corpus").assetType(fundId).currentValue(0.0).build();
                                        }
                                        fund.setCurrentValue(fund.getCurrentValue() + (projectedSavings * (pct / 100.0)));
                                        assetRepository.save(fund);
                                    }
                                }
                            }
                            
                            // Apply Unallocated
                            double unallocatedPct = Math.max(0.0, 100.0 - totalAllocatedPct);
                            if (unallocatedPct > 0) {
                                Asset unalloc = assets.stream().filter(a -> "UNALLOCATED".equals(a.getAssetType())).findFirst().orElse(null);
                                if (unalloc == null) {
                                    unalloc = Asset.builder().user(user).name("Unallocated Savings").assetType("UNALLOCATED").currentValue(0.0).build();
                                }
                                unalloc.setCurrentValue(unalloc.getCurrentValue() + (projectedSavings * (unallocatedPct / 100.0)));
                                assetRepository.save(unalloc);
                            }
                        }

                        // Record the transaction to prevent duplicate processing
                        Transaction record = new Transaction();
                        record.setUser(user);
                        record.setType(Transaction.TransactionType.CREDIT);
                        record.setAmount(projectedSavings); // Just for logging/preventing duplicates
                        record.setCategory("Savings");
                        record.setDescription("Automated Savings Deposit");
                        record.setDate(today);
                        transactionRepository.save(record);

                        Notification notification = new Notification();
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
