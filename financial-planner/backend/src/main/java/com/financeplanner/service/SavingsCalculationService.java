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

    public double calculateLiveTotalSavings(User user) {
        Map<String, Object> breakdown = getSavingsBreakdown(user);
        return (Double) breakdown.get("totalSavings");
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

        Map<String, double[]> monthlyTotals = new HashMap<>(); // key: "YYYY-MM", val: [income, expense]

        LocalDate curr = startDate;
        while (!curr.isAfter(m0)) {
            String key = curr.getYear() + "-" + curr.getMonthValue();
            double inc = 0.0;
            double exp = 0.0;

            boolean isCurrent = curr.equals(m0);

            // Add templates
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

            // Add transactions for this month
            for (Transaction t : txns) {
                if (t.getDate().getYear() == curr.getYear() && t.getDate().getMonthValue() == curr.getMonthValue()) {
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

        double totalSavings = manualSavings + olderCumulative + recentNetSum;

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
        Map<String, Double> preExistingAssets = new HashMap<>();
        preExistingAssets.put("RETIREMENT", 0.0);
        preExistingAssets.put("LONG_TERM", 0.0);
        preExistingAssets.put("SHORT_TERM", 0.0);
        preExistingAssets.put("EMERGENCY", 0.0);
        preExistingAssets.put("WEALTH", 0.0);
        preExistingAssets.put("UNALLOCATED", 0.0);

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
        double retPercent = 0.0;
        Map<String, Double> coreAlloc = new HashMap<>();
        coreAlloc.put("LONG_TERM", 25.0);
        coreAlloc.put("SHORT_TERM", 25.0);
        coreAlloc.put("EMERGENCY", 25.0);
        coreAlloc.put("WEALTH", 25.0);

        if (fundAllocJson != null && !fundAllocJson.trim().isEmpty()) {
            try {
                Map<String, Object> parsed = mapper.readValue(fundAllocJson, new TypeReference<Map<String, Object>>() {});
                if (parsed.containsKey("retirement") && parsed.get("retirement") != null) {
                    retPercent = ((Number) parsed.get("retirement")).doubleValue();
                }
                if (parsed.containsKey("core") && parsed.get("core") != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coreMap = (Map<String, Object>) parsed.get("core");
                    for (Map.Entry<String, Object> entry : coreMap.entrySet()) {
                        if (entry.getValue() instanceof Number) {
                            coreAlloc.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        double totalAllocatedPct = retPercent;
        for (Double val : coreAlloc.values()) {
            totalAllocatedPct += val;
        }
        double unallocatedPct = Math.max(0.0, 100.0 - totalAllocatedPct);

        List<Map<String, Object>> fundSummaries = new ArrayList<>();
        String[][] fundDefs = {
            {"RETIREMENT", "Retirement Corpus", "1. Retirement Corpus"},
            {"LONG_TERM", "Long-Term Goal Corpus", "2. Long-Term Goal Corpus"},
            {"SHORT_TERM", "Short-Term Goal Corpus", "3. Short-Term Goal Corpus"},
            {"EMERGENCY", "Emergency & Protection Corpus", "4. Emergency & Protection Corpus"},
            {"WEALTH", "Wealth Creation Corpus", "5. Wealth Creation Corpus"},
            {"UNALLOCATED", "Unallocated Savings", "6. Unallocated Savings"}
        };

        for (String[] def : fundDefs) {
            String fundId = def[0];
            String name = def[1];
            String fullName = def[2];

            double pct = 0.0;
            if ("RETIREMENT".equals(fundId)) pct = retPercent;
            else if ("UNALLOCATED".equals(fundId)) pct = unallocatedPct;
            else pct = coreAlloc.getOrDefault(fundId, 0.0);

            double storedAssetBal = preExistingAssets.getOrDefault(fundId, 0.0);
            double monthlyContrib = expectedMonthlySavings * (pct / 100.0);
            double totalBalance = Math.round(storedAssetBal + monthlyContrib);

            // Skip Retirement Corpus if user has not set up retirement planning (0% alloc and 0 balance)
            if ("RETIREMENT".equals(fundId) && pct == 0.0 && storedAssetBal == 0.0) {
                continue;
            }

            Map<String, Object> fundObj = new HashMap<>();
            fundObj.put("id", fundId);
            fundObj.put("name", name);
            fundObj.put("fullName", fullName);
            fundObj.put("percent", pct);
            fundObj.put("storedAssetBalance", storedAssetBal);
            fundObj.put("monthlyAlloc", Math.round(monthlyContrib));
            fundObj.put("balance", totalBalance);

            fundSummaries.add(fundObj);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalSavings", liveTotalSavings);
        result.put("expectedMonthlySavings", expectedMonthlySavings);
        result.put("funds", fundSummaries);
        return result;
    }
}
