package com.financeplanner.service;

import com.financeplanner.entity.FixedExpense;
import com.financeplanner.entity.IncomeSource;
import com.financeplanner.entity.MonthlyStatementVerification;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.FixedExpenseRepository;
import com.financeplanner.repository.IncomeSourceRepository;
import com.financeplanner.repository.MonthlyStatementVerificationRepository;
import com.financeplanner.repository.TransactionRepository;
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
}
