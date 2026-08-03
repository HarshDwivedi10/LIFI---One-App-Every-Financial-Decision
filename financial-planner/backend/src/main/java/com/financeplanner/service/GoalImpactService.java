package com.financeplanner.service;

import com.financeplanner.dto.GoalImpactResponse;
import com.financeplanner.dto.GoalSimulationRequest;
import com.financeplanner.entity.Goal;
import com.financeplanner.entity.RetirementPlan;
import com.financeplanner.entity.User;
import com.financeplanner.entity.IncomeSource;
import com.financeplanner.repository.GoalRepository;
import com.financeplanner.repository.IncomeSourceRepository;
import com.financeplanner.repository.RetirementPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoalImpactService {

    private final GoalRepository goalRepository;
    private final IncomeSourceRepository incomeSourceRepository;
    private final RetirementPlanRepository retirementPlanRepository;

    public GoalImpactResponse simulate(User user, GoalSimulationRequest request) {
        // Fetch current state
        List<Goal> existingGoals = goalRepository.findByUser(user);
        List<IncomeSource> incomes = incomeSourceRepository.findByUserId(user.getId());
        List<RetirementPlan> retirementPlans = retirementPlanRepository.findByUserId(user.getId());
        
        double totalMonthlyIncome = incomes.stream().mapToDouble(IncomeSource::getAmount).sum();
        double currentTotalMonthlySavings = user.getManualTotalSavings() != null ? user.getManualTotalSavings() : (totalMonthlyIncome * 0.2); // fallback to 20%
        
        // Deep copy goals for simulation
        List<Goal> simulatedGoals = new ArrayList<>();
        for (Goal g : existingGoals) {
            simulatedGoals.add(cloneGoal(g));
        }

        // Apply simulation request
        applyRequest(user, request, simulatedGoals);

        // Recalculate totals
        double newTotalIncome = totalMonthlyIncome;
        if (request.getType() == GoalSimulationRequest.SimulationType.SALARY_CHANGE && request.getNewSalary() != null) {
            newTotalIncome = request.getNewSalary();
        }
        
        double newMonthlySavings = currentTotalMonthlySavings;
        if (request.getType() == GoalSimulationRequest.SimulationType.SAVINGS_CHANGE && request.getNewMonthlySavings() != null) {
            newMonthlySavings = request.getNewMonthlySavings();
        } else if (request.getType() == GoalSimulationRequest.SimulationType.SALARY_CHANGE) {
            newMonthlySavings = (newTotalIncome / totalMonthlyIncome) * currentTotalMonthlySavings; // scale savings
        }

        double totalRequiredAllocation = simulatedGoals.stream()
                .mapToDouble(g -> g.getMonthlyAllocation() != null ? g.getMonthlyAllocation() : 0.0)
                .sum();
                
        if (request.getType() == GoalSimulationRequest.SimulationType.ONE_TIME_PURCHASE && request.getPurchaseAmount() != null) {
            // A one-time purchase reduces available savings this month, simulating a gap
            totalRequiredAllocation += request.getPurchaseAmount();
        }

        double fundingGap = totalRequiredAllocation - newMonthlySavings;
        boolean feasible = fundingGap <= 0;

        List<GoalImpactResponse.AffectedGoal> affectedGoals = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        if (!feasible) {
            // Need to delay goals based on priority
            // HIGH > MEDIUM > LOW
            // Priority order: LOW first, then MEDIUM, then HIGH
            simulatedGoals.sort((g1, g2) -> {
                int p1 = getPriorityValue(g1.getPriority());
                int p2 = getPriorityValue(g2.getPriority());
                return Integer.compare(p1, p2); // lower priority value means delayed first
            });

            double currentGap = fundingGap;
            for (Goal g : simulatedGoals) {
                if (currentGap <= 0) break;
                if (g.getMonthlyAllocation() == null || g.getMonthlyAllocation() <= 0) continue;

                // How many months to delay to cover gap? 
                // Simplified: if we reduce allocation by currentGap, we extend the time
                double allocToReduce = Math.min(g.getMonthlyAllocation(), currentGap);
                currentGap -= allocToReduce;
                
                int delayMonths = (int) Math.ceil((g.getCost() / (g.getMonthlyAllocation() - allocToReduce + 0.1)) - (g.getCost() / g.getMonthlyAllocation()));
                
                if (delayMonths > 0) {
                    GoalImpactResponse.AffectedGoal affected = GoalImpactResponse.AffectedGoal.builder()
                            .goalId(g.getId())
                            .name(g.getName())
                            .originalTargetDate(g.getTargetDate().toString())
                            .newTargetDate(g.getTargetDate().plusMonths(delayMonths).toString())
                            .delayMonths(delayMonths)
                            .build();
                    affectedGoals.add(affected);
                    
                    if (g.getPriority() == Goal.Priority.HIGH) {
                        recommendations.add("Warning: High priority goal '" + g.getName() + "' is delayed by " + delayMonths + " months.");
                    } else {
                        recommendations.add("Delayed " + (g.getPriority() != null ? g.getPriority().name() : "MEDIUM") + " priority goal '" + g.getName() + "'.");
                    }
                }
            }
        }

        // Retirement Impact
        GoalImpactResponse.RetirementImpact retirementImpact = new GoalImpactResponse.RetirementImpact();
        if (!retirementPlans.isEmpty()) {
            RetirementPlan currentPlan = retirementPlans.get(0);
            retirementImpact.setOriginalRetirementAge(currentPlan.getRetirementAge());
            retirementImpact.setOriginalCorpus(currentPlan.getCurrentRetirementSavings());
            
            int newRetAge = currentPlan.getRetirementAge();
            if (request.getType() == GoalSimulationRequest.SimulationType.RETIREMENT_AGE_CHANGE && request.getNewRetirementAge() != null) {
                newRetAge = request.getNewRetirementAge();
            }
            retirementImpact.setNewRetirementAge(newRetAge);
            
            // simple corpus estimation change if savings dropped
            double corpusImpact = 0.0;
            if (fundingGap > 0) {
                // assume funding gap reduces retirement contributions if no goals are delayed
                corpusImpact = -fundingGap * 12 * (newRetAge - currentPlan.getCurrentAge());
            }
            retirementImpact.setNewCorpus(Math.max(0, (currentPlan.getCurrentRetirementSavings() != null ? currentPlan.getCurrentRetirementSavings() : 0.0) + corpusImpact));
        }

        GoalImpactResponse.MonthlySavingsImpact savingsImpact = GoalImpactResponse.MonthlySavingsImpact.builder()
                .previousRemainingSavings(currentTotalMonthlySavings)
                .newRemainingSavings(newMonthlySavings)
                .fundingGap(Math.max(0, fundingGap))
                .build();

        GoalImpactResponse.FundImpact fundImpact = GoalImpactResponse.FundImpact.builder()
                .emergencyFundImpact(request.getType() == GoalSimulationRequest.SimulationType.ONE_TIME_PURCHASE ? -request.getPurchaseAmount() : 0.0)
                .allocationImpacts(new HashMap<>())
                .build();

        double impactScore = feasible ? 100.0 : Math.max(0, 100.0 - (fundingGap / newMonthlySavings * 100));

        if (feasible) {
            recommendations.add("This action is financially feasible.");
        } else {
            recommendations.add("Consider increasing income or reducing goal costs to avoid delaying goals.");
        }

        return GoalImpactResponse.builder()
                .impactScore(impactScore)
                .feasible(feasible)
                .affectedGoals(affectedGoals)
                .retirementImpact(retirementImpact)
                .monthlySavingsImpact(savingsImpact)
                .fundImpact(fundImpact)
                .recommendations(recommendations)
                .revisedTimeline(new ArrayList<>())
                .comparison(new HashMap<>())
                .build();
    }

    private void applyRequest(User user, GoalSimulationRequest request, List<Goal> simulatedGoals) {
        switch (request.getType()) {
            case NEW_GOAL:
                Goal newGoal = new Goal();
                newGoal.setId(-1L);
                newGoal.setName(request.getName());
                newGoal.setCost(request.getCost());
                newGoal.setTargetDate(request.getTargetDate());
                newGoal.setMonthlyAllocation(request.getMonthlyAllocation());
                newGoal.setPriority(request.getPriority());
                simulatedGoals.add(newGoal);
                break;
            case UPDATE_GOAL:
                for (Goal g : simulatedGoals) {
                    if (g.getId() != null && g.getId().equals(request.getGoalId())) {
                        if (request.getName() != null) g.setName(request.getName());
                        if (request.getCost() != null) g.setCost(request.getCost());
                        if (request.getTargetDate() != null) g.setTargetDate(request.getTargetDate());
                        if (request.getMonthlyAllocation() != null) g.setMonthlyAllocation(request.getMonthlyAllocation());
                        if (request.getPriority() != null) g.setPriority(request.getPriority());
                    }
                }
                break;
            case DELETE_GOAL:
                simulatedGoals.removeIf(g -> g.getId() != null && g.getId().equals(request.getGoalId()));
                break;
            default:
                break; // Handled in simulate method directly
        }
    }

    private Goal cloneGoal(Goal original) {
        Goal clone = new Goal();
        clone.setId(original.getId());
        clone.setName(original.getName());
        clone.setCost(original.getCost());
        clone.setCategory(original.getCategory());
        clone.setTargetDate(original.getTargetDate());
        clone.setMonthlyAllocation(original.getMonthlyAllocation());
        clone.setIsDelayed(original.getIsDelayed());
        clone.setAcknowledged(original.getAcknowledged());
        clone.setPriority(original.getPriority());
        return clone;
    }

    private int getPriorityValue(Goal.Priority priority) {
        if (priority == null) return 2; // Default to MEDIUM equivalent value for calculation
        switch (priority) {
            case HIGH: return 3;
            case MEDIUM: return 2;
            case LOW: return 1;
            default: return 2;
        }
    }
}
