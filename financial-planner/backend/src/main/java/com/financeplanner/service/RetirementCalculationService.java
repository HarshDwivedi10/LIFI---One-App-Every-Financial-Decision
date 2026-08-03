package com.financeplanner.service;

import com.financeplanner.entity.RetirementPlan;
import com.financeplanner.repository.RetirementPlanRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RetirementCalculationService {

    private final RetirementPlanRepository planRepo;
    private final ObjectMapper objectMapper;

    /**
     * Calculates retirement projections based on mode and inputs.
     * All financial formulas are implemented here as per spec.
     */
    public Map<String, Object> calculate(RetirementPlan plan) {
        int yearsUntilRetirement = plan.getRetirementAge() - plan.getCurrentAge();
        int monthsUntilRetirement = yearsUntilRetirement * 12;

        double annualReturn   = plan.getExpectedReturn() / 100.0;
        double monthlyReturn  = annualReturn / 12.0;
        double inflRate       = plan.getInflationRate() / 100.0;
        double wdRate         = plan.getWithdrawalRate() / 100.0;
        double currentSavings = plan.getCurrentRetirementSavings() != null ? plan.getCurrentRetirementSavings() : 0.0;

        // Future value of current retirement savings
        double fvCurrentSavings = currentSavings * Math.pow(1 + annualReturn, yearsUntilRetirement);

        Map<String, Object> result = new HashMap<>();
        result.put("yearsUntilRetirement", yearsUntilRetirement);
        result.put("currentRetirementSavings", currentSavings);
        result.put("futureValueCurrentSavings", round(fvCurrentSavings));

        if ("MODE1".equals(plan.getMode())) {
            calculateMode1(plan, yearsUntilRetirement, monthsUntilRetirement,
                    monthlyReturn, inflRate, wdRate, fvCurrentSavings, result);
        } else if ("MODE_OPTIMIZER".equals(plan.getMode())) {
            calculateOptimizer(plan, monthlyReturn, inflRate, wdRate, result);
        }

        // Persist result
        try {
            plan.setResultJson(objectMapper.writeValueAsString(result));
        } catch (Exception e) {
            plan.setResultJson("{}");
        }
        planRepo.save(plan);

        return result;
    }

    /* ── Mode 1: Calculate My Retirement Plan ────────────────────────── */
    private void calculateMode1(RetirementPlan plan, int years, int months,
                                 double mr, double ir, double wr,
                                 double fvSavings, Map<String, Object> r) {
        double currentExpense = plan.getCurrentMonthlyExpense();
        double futureMonthlyExpense = currentExpense * Math.pow(1 + ir, years);
        double futureAnnualExpense  = futureMonthlyExpense * 12;
        double requiredCorpus       = futureAnnualExpense / wr;
        double gap                  = requiredCorpus - fvSavings;
        double requiredMonthly      = gap > 0
                ? (gap * mr) / (Math.pow(1 + mr, months) - 1) : 0;
        double expectedMonthlyIncome = (requiredCorpus * wr) / 12.0;

        r.put("futureMonthlyExpense", round(futureMonthlyExpense));
        r.put("futureAnnualExpense", round(futureAnnualExpense));
        r.put("requiredCorpus", round(requiredCorpus));
        r.put("requiredMonthlyContribution", round(Math.max(0, requiredMonthly)));
        r.put("expectedMonthlyRetirementIncome", round(expectedMonthlyIncome));
    }


    /* ── Mode Optimizer: Retirement Age Optimizer ────────────────────────── */
    private void calculateOptimizer(RetirementPlan plan, double mr, double ir, double wr, Map<String, Object> r) {
        double currentExpense = plan.getCurrentMonthlyExpense() != null ? plan.getCurrentMonthlyExpense() : 0.0;
        double currentSavings = plan.getCurrentRetirementSavings() != null ? plan.getCurrentRetirementSavings() : 0.0;
        double currentContribution = plan.getCurrentMonthlyContribution() != null ? plan.getCurrentMonthlyContribution() : 0.0;
        int maxYears = 100 - (plan.getCurrentAge() != null ? plan.getCurrentAge() : 30);
        int optimalYear = -1;

        for (int y = 1; y <= maxYears; y++) {
            double fvSavings = currentSavings * Math.pow(1 + mr * 12, y); // simplified annual compounding
            double fvContribs = currentContribution * ((Math.pow(1 + mr, y * 12) - 1) / mr);
            double futureMonthlyExpense = currentExpense * Math.pow(1 + ir, y);
            double requiredCorpus = (futureMonthlyExpense * 12) / wr;
            
            if (fvSavings + fvContribs >= requiredCorpus) {
                optimalYear = y;
                break;
            }
        }
        
        int earliestAge = optimalYear != -1 ? plan.getCurrentAge() + optimalYear : -1;
        r.put("earliestRetirementAge", earliestAge);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
