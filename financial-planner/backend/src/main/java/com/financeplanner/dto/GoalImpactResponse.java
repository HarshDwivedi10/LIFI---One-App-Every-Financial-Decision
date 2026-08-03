package com.financeplanner.dto;

import com.financeplanner.entity.Goal.Priority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoalImpactResponse {
    private Double impactScore;
    private Boolean feasible;
    private List<AffectedGoal> affectedGoals;
    private RetirementImpact retirementImpact;
    private MonthlySavingsImpact monthlySavingsImpact;
    private FundImpact fundImpact;
    private List<String> recommendations;
    private List<RevisedTimeline> revisedTimeline;
    private Map<String, Object> comparison; // Stores before and after metrics

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AffectedGoal {
        private Long goalId;
        private String name;
        private String originalTargetDate;
        private String newTargetDate;
        private Integer delayMonths;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RetirementImpact {
        private Integer originalRetirementAge;
        private Integer newRetirementAge;
        private Double originalCorpus;
        private Double newCorpus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlySavingsImpact {
        private Double previousRemainingSavings;
        private Double newRemainingSavings;
        private Double fundingGap;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FundImpact {
        private Double emergencyFundImpact;
        private Map<String, Double> allocationImpacts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevisedTimeline {
        private String month;
        private Map<String, Double> allocations;
        private Double cumulativeSavings;
    }
}
