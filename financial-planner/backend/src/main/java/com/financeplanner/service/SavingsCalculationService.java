package com.financeplanner.service;

import com.financeplanner.entity.FixedExpense;
import com.financeplanner.entity.IncomeSource;
import com.financeplanner.entity.MonthlyStatementVerification;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.entity.Asset;
import com.financeplanner.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SavingsCalculationService {

    private final TransactionRepository transactionRepository;
    private final MonthlyStatementVerificationRepository verificationRepository;
    private final IncomeSourceRepository incomeSourceRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;

    public double calculateLiveTotalSavings(User user) {
        Map<String, Object> breakdown = getSavingsBreakdown(user);
        return (Double) breakdown.get("totalSavings");
    }

    public void trackDiscrepancyOperation(User user, String reason, Runnable action) {
        double oldTotal = calculateLiveTotalSavings(user);
        action.run();
        double newTotal = calculateLiveTotalSavings(user);
        
        if (Math.abs(newTotal - oldTotal) > 1.0) {
            user.setLastDiscrepancySource(reason);
            userRepository.save(user);
        }
    }

    public Map<String, Object> getSavingsBreakdown(User user) {
        double manualSavings = user.getManualTotalSavings() != null ? user.getManualTotalSavings() : 0.0;
        String savingsDate = user.getPreExistingSavingsDate() != null ? user.getPreExistingSavingsDate() : "";

        LocalDate today = LocalDate.now();
        
        List<Transaction> txns = transactionRepository.findByUserId(user.getId());
        List<IncomeSource> incomeSources = incomeSourceRepository.findByUserId(user.getId());
        List<FixedExpense> fixedExpenses = fixedExpenseRepository.findByUserId(user.getId());

        LocalDate m0 = today.withDayOfMonth(1);
        LocalDate m1 = m0.minusMonths(1);
        LocalDate m2 = m0.minusMonths(2);
        List<LocalDate> recentMonthsDates = Arrays.asList(m2, m1, m0);

        // Find startDate
        LocalDate startDate = user.getCreatedAt() != null ? user.getCreatedAt().toLocalDate().withDayOfMonth(1) : m0;
        for (Transaction t : txns) {
            LocalDate tDate = t.getDate().withDayOfMonth(1);
            if (tDate.isBefore(startDate)) {
                startDate = tDate;
            }
        }
        if (startDate.isAfter(m2)) {
            startDate = m2; // Ensure at least 3 months are tracked
        }

        LocalDate regMonth = user.getCreatedAt() != null ? user.getCreatedAt().toLocalDate().withDayOfMonth(1) : m0;

        Map<String, double[]> monthlyTotals = new HashMap<>(); // key: "YYYY-MM", val: [income, expense]

        LocalDate curr = startDate;
        while (!curr.isAfter(m0)) {
            String key = curr.getYear() + "-" + curr.getMonthValue();
            double inc = 0.0;
            double exp = 0.0;

            boolean isCurrent = curr.equals(m0);

            // Add templates only for current month or months on/after user registration
            if (isCurrent || !curr.isBefore(regMonth)) {
                for (IncomeSource src : incomeSources) {
                    if (isCurrent) {
                        int day = src.getDayOfMonth() != null ? src.getDayOfMonth() : 1;
                        if (day <= today.getDayOfMonth()) inc += src.getAmount();
                    } else {
                        inc += src.getAmount();
                    }
                }

                for (FixedExpense fx : fixedExpenses) {
                    if (isCurrent) {
                        int day = fx.getDayOfMonth() != null ? fx.getDayOfMonth() : 1;
                        if (day <= today.getDayOfMonth()) exp += fx.getAmount();
                    } else {
                        exp += fx.getAmount();
                    }
                }
            }

            // Add transactions for this month (excluding auto-created fixed expense transactions to avoid double-counting)
            for (Transaction t : txns) {
                if (t.getDate().getYear() == curr.getYear() && t.getDate().getMonthValue() == curr.getMonthValue()) {
                    if (t.getFixedExpenseId() != null) {
                        continue;
                    }
                    if (t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT) {
                        exp += t.getAmount();
                    } else if (t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT) {
                        inc += t.getAmount();
                    }
                }
            }
            
            monthlyTotals.put(key, new double[]{inc, exp});
            curr = curr.plusMonths(1);
        }

        double recentNetSum = 0.0;
        double olderCumulative = 0.0;
        List<Map<String, Object>> recentMonthsList = new ArrayList<>();
        Set<String> recentKeys = new HashSet<>();
        
        for (LocalDate mDate : recentMonthsDates) {
            String key = mDate.getYear() + "-" + mDate.getMonthValue();
            recentKeys.add(key);

            double[] incExp = monthlyTotals.getOrDefault(key, new double[]{0.0, 0.0});
            double inc = incExp[0];
            double exp = incExp[1];
            double net = inc - exp;

            recentNetSum += net;

            Map<String, Object> monthData = new HashMap<>();
            monthData.put("year", mDate.getYear());
            monthData.put("month", mDate.getMonthValue());
            monthData.put("label", mDate.getMonth().name().substring(0,1) + mDate.getMonth().name().substring(1).toLowerCase() + " " + mDate.getYear() + (mDate.equals(m0) ? " (Current)" : ""));
            monthData.put("income", inc);
            monthData.put("expense", exp);
            monthData.put("netSavings", net);
            monthData.put("isCurrent", mDate.equals(m0));
            recentMonthsList.add(monthData);
        }

        for (Map.Entry<String, double[]> entry : monthlyTotals.entrySet()) {
            if (!recentKeys.contains(entry.getKey())) {
                double[] val = entry.getValue();
                olderCumulative += (val[0] - val[1]);
            }
        }

        List<MonthlyStatementVerification> verifications = verificationRepository.findByUserId(user.getId());
        double totalAppliedDeficit = verifications.stream().mapToDouble(MonthlyStatementVerification::getAppliedDeficit).sum();

        double totalSavings = manualSavings + olderCumulative + recentNetSum - totalAppliedDeficit;

        Map<String, Object> result = new HashMap<>();
        result.put("manualTotalSavings", manualSavings);
        result.put("preExistingSavingsDate", savingsDate);
        result.put("olderSavingsCumulative", olderCumulative);
        result.put("recentMonths", recentMonthsList);
        result.put("totalSavings", totalSavings);

        return result;
    }

    public Map<String, Object> getFundBalances(User user) {
        Map<String, Object> breakdown = getSavingsBreakdown(user);
        double liveTotalSavings = (Double) breakdown.get("totalSavings");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recentMonths = (List<Map<String, Object>>) breakdown.get("recentMonths");
        double expectedMonthlySavings = 0.0;
        if (recentMonths != null && !recentMonths.isEmpty()) {
            Map<String, Object> currentM = recentMonths.get(recentMonths.size() - 1);
            if (currentM != null && currentM.get("netSavings") != null) {
                expectedMonthlySavings = Math.max(0.0, ((Number) currentM.get("netSavings")).doubleValue());
            }
        }

        List<Asset> assetsList = assetRepository.findByUserId(user.getId());
        double sumAssets = assetsList.stream().mapToDouble(a -> a.getCurrentValue() != null ? a.getCurrentValue() : 0.0).sum();
        if (assetsList.isEmpty() || sumAssets == 0.0) {
            // Ensure at least UNALLOCATED exists
            boolean unallocExists = assetsList.stream().anyMatch(a -> "UNALLOCATED".equals(a.getAssetType()));
            if (!unallocExists) {
                syncPreExistingAssets(user, user.getManualTotalSavings() != null ? user.getManualTotalSavings() : liveTotalSavings);
                assetsList = assetRepository.findByUserId(user.getId());
            }
        }

        Map<String, Double> preExistingAssets = new HashMap<>();
        preExistingAssets.put("UNALLOCATED", 0.0);
        for (Asset a : assetsList) {
            if (a.getAssetType() != null) {
                preExistingAssets.put(a.getAssetType(), 0.0);
            }
        }

        ObjectMapper mapper = new ObjectMapper();

        for (Asset a : assetsList) {
            String type = a.getAssetType();
            Double val = a.getCurrentValue() != null ? a.getCurrentValue() : 0.0;

            if (type != null && preExistingAssets.containsKey(type)) {
                if (a.getFundAllocations() == null || a.getFundAllocations().trim().isEmpty() || a.getFundAllocations().equals("[]")) {
                    preExistingAssets.put(type, preExistingAssets.get(type) + val);
                }
            }

            if (a.getFundAllocations() != null && !a.getFundAllocations().trim().isEmpty()) {
                try {
                    List<Map<String, Object>> allocs = mapper.readValue(a.getFundAllocations(), new TypeReference<List<Map<String, Object>>>() {});
                    for (Map<String, Object> alloc : allocs) {
                        String fundType = (String) alloc.get("fundType");
                        Number pctNum = (Number) alloc.get("percentage");
                        if (fundType != null && preExistingAssets.containsKey(fundType) && pctNum != null) {
                            double pct = pctNum.doubleValue();
                            preExistingAssets.put(fundType, preExistingAssets.get(fundType) + (val * (pct / 100.0)));
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        String fundAllocJson = user.getFundAllocationsJson();
        Map<String, Double> customAllocs = new HashMap<>();

        if (fundAllocJson != null && !fundAllocJson.trim().isEmpty()) {
            try {
                Map<String, Object> parsed = mapper.readValue(fundAllocJson, new TypeReference<Map<String, Object>>() {});
                LocalDate today = LocalDate.now();
                String monthKey = today.getYear() + "-" + String.format("%02d", today.getMonthValue());
                
                if (parsed.containsKey("_timeline") && ((Map<String, Object>) parsed.get("_timeline")).containsKey(monthKey)) {
                    Map<String, Object> monthAllocations = (Map<String, Object>) ((Map<String, Object>) parsed.get("_timeline")).get(monthKey);
                    for (Map.Entry<String, Object> entry : monthAllocations.entrySet()) {
                        if (entry.getValue() instanceof Number) {
                            customAllocs.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                        }
                    }
                } else if (parsed.containsKey("core") || parsed.containsKey("retirement")) {
                    // Migrate/parse old structure
                    if (parsed.containsKey("retirement") && parsed.get("retirement") != null) {
                        customAllocs.put("RETIREMENT", ((Number) parsed.get("retirement")).doubleValue());
                    }
                    if (parsed.containsKey("core") && parsed.get("core") != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> coreMap = (Map<String, Object>) parsed.get("core");
                        for (Map.Entry<String, Object> entry : coreMap.entrySet()) {
                            if (entry.getValue() instanceof Number) {
                                customAllocs.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                            }
                        }
                    }
                } else {
                    for (Map.Entry<String, Object> entry : parsed.entrySet()) {
                        if (entry.getValue() instanceof Number && !"_metadata".equals(entry.getKey()) && !"_timeline".equals(entry.getKey())) {
                            customAllocs.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        double totalAllocatedPct = 0.0;
        for (Map.Entry<String, Double> entry : customAllocs.entrySet()) {
            if (!"UNALLOCATED".equals(entry.getKey())) {
                totalAllocatedPct += entry.getValue();
            }
        }
        double unallocatedPct = Math.max(0.0, 100.0 - totalAllocatedPct);

        List<Map<String, Object>> fundSummaries = new ArrayList<>();
        Set<String> allFundIds = new LinkedHashSet<>();
        
        // Ensure user's database assets are added in order
        for (Asset a : assetsList) {
            if (a.getAssetType() != null && !"UNALLOCATED".equals(a.getAssetType())) {
                allFundIds.add(a.getAssetType());
            }
        }
        // Add any additional allocated funds
        for (String id : customAllocs.keySet()) {
            if (!"UNALLOCATED".equals(id)) {
                allFundIds.add(id);
            }
        }

        Map<String, String> fundNames = new HashMap<>();
        fundNames.put("UNALLOCATED", "Unallocated Savings");
        for (Asset a : assetsList) {
            if (a.getAssetType() != null) {
                fundNames.put(a.getAssetType(), a.getName());
            }
        }

        int idx = 1;
        for (String fundId : allFundIds) {
            double pct = customAllocs.getOrDefault(fundId, 0.0);
            double storedAssetBal = preExistingAssets.getOrDefault(fundId, 0.0);
            double monthlyContrib = expectedMonthlySavings * (pct / 100.0);
            double totalBalance = Math.round(storedAssetBal + monthlyContrib);

            // Find matching asset ID
            Long assetId = null;
            for (Asset a : assetsList) {
                if (fundId.equals(a.getAssetType())) {
                    assetId = a.getId();
                    break;
                }
            }

            Map<String, Object> fundObj = new HashMap<>();
            fundObj.put("id", fundId);
            fundObj.put("name", fundNames.getOrDefault(fundId, fundId));
            fundObj.put("fullName", idx + ". " + fundNames.getOrDefault(fundId, fundId));
            fundObj.put("percent", pct);
            fundObj.put("storedAssetBalance", storedAssetBal);
            fundObj.put("monthlyAlloc", Math.round(monthlyContrib));
            fundObj.put("balance", totalBalance);
            fundObj.put("assetId", assetId);

            fundSummaries.add(fundObj);
            idx++;
        }

        // Add UNALLOCATED at the end
        double storedUnallocatedBal = preExistingAssets.getOrDefault("UNALLOCATED", 0.0);
        double monthlyUnallocatedContrib = expectedMonthlySavings * (unallocatedPct / 100.0);
        double totalUnallocatedBalance = Math.round(storedUnallocatedBal + monthlyUnallocatedContrib);

        Long unallocAssetId = null;
        for (Asset a : assetsList) {
            if ("UNALLOCATED".equals(a.getAssetType())) {
                unallocAssetId = a.getId();
                break;
            }
        }

        Map<String, Object> unallocatedObj = new HashMap<>();
        unallocatedObj.put("id", "UNALLOCATED");
        unallocatedObj.put("name", "Unallocated Savings");
        unallocatedObj.put("fullName", idx + ". Unallocated Savings");
        unallocatedObj.put("percent", unallocatedPct);
        unallocatedObj.put("storedAssetBalance", storedUnallocatedBal);
        unallocatedObj.put("monthlyAlloc", Math.round(monthlyUnallocatedContrib));
        unallocatedObj.put("balance", totalUnallocatedBalance);
        unallocatedObj.put("assetId", unallocAssetId);
        
        fundSummaries.add(unallocatedObj);

        Map<String, Object> result = new HashMap<>();
        result.put("totalSavings", liveTotalSavings);
        result.put("expectedMonthlySavings", expectedMonthlySavings);
        result.put("funds", fundSummaries);
        return result;
    }

    @org.springframework.transaction.annotation.Transactional
    public void syncPreExistingAssets(User user, Double manualTotalSavings) {
        if (user == null || user.getId() == null) return;
        User dbUser = userRepository.findById(user.getId()).orElse(user);
        if (manualTotalSavings == null) manualTotalSavings = 0.0;

        ObjectMapper mapper = new ObjectMapper();
        String fundAllocJson = dbUser.getFundAllocationsJson();
        Map<String, Double> customAllocs = new HashMap<>();
        
        if (fundAllocJson != null && !fundAllocJson.trim().isEmpty()) {
            try {
                Map<String, Object> parsed = mapper.readValue(fundAllocJson, new TypeReference<Map<String, Object>>() {});
                if (parsed.containsKey("core") || parsed.containsKey("retirement")) {
                    if (parsed.containsKey("retirement") && parsed.get("retirement") != null) {
                        customAllocs.put("RETIREMENT", ((Number) parsed.get("retirement")).doubleValue());
                    }
                    if (parsed.containsKey("core") && parsed.get("core") != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> coreMap = (Map<String, Object>) parsed.get("core");
                        for (Map.Entry<String, Object> entry : coreMap.entrySet()) {
                            if (entry.getValue() instanceof Number) {
                                customAllocs.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                            }
                        }
                    }
                } else {
                    for (Map.Entry<String, Object> entry : parsed.entrySet()) {
                        if (entry.getValue() instanceof Number) {
                            customAllocs.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        List<Asset> existingAssets = assetRepository.findByUserId(dbUser.getId());
        
        if (existingAssets.isEmpty()) {
            Asset unallocated = Asset.builder()
                    .user(dbUser)
                    .name("Unallocated Savings")
                    .assetType("UNALLOCATED")
                    .currentValue(manualTotalSavings)
                    .fundAllocations("[]")
                    .build();
            assetRepository.save(unallocated);
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void adjustUnallocatedSavings(User user, double delta) {
        if (user == null || user.getId() == null || delta == 0.0) return;
        List<Asset> assets = assetRepository.findByUserId(user.getId());
        Asset unalloc = assets.stream().filter(a -> "UNALLOCATED".equals(a.getAssetType())).findFirst().orElse(null);
        if (unalloc != null) {
            unalloc.setCurrentValue((unalloc.getCurrentValue() != null ? unalloc.getCurrentValue() : 0.0) + delta);
            assetRepository.save(unalloc);
        }
    }
}
