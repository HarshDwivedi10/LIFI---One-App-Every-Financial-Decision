package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AdminDashboardDTO {

    private StatsDTO stats;
    private ChartsDTO charts;
    private TablesDTO tables;

    @Data
    @Builder
    public static class StatsDTO {
        private long totalUsers;
        private long totalCoaches;
        private long pendingCoachRequests;
        private long activeCoaches;
        private long totalTransactions;
        private double totalAssets;
    }

    @Data
    @Builder
    public static class ChartsDTO {
        private List<MonthlyRegistrationDTO> monthlyUserRegistrations;
        private List<RatioDTO> userCoachRatio;
        private List<RatioDTO> activeVsPendingCoaches;
    }

    @Data
    @Builder
    public static class TablesDTO {
        private List<UserSummaryDTO> recentUsers;
        private List<CoachSummaryDTO> pendingCoaches;
        private List<CoachSummaryDTO> recentCoaches;
    }

    @Data
    @Builder
    public static class MonthlyRegistrationDTO {
        private String month;
        private long count;
    }

    @Data
    @Builder
    public static class RatioDTO {
        private String name;
        private long value;
    }

    @Data
    @Builder
    public static class UserSummaryDTO {
        private Long id;
        private String name;
        private String email;
        private String role;
        private String status;
        private String createdAt;
    }

    @Data
    @Builder
    public static class CoachSummaryDTO {
        private Long id;
        private String name;
        private String email;
        private String status;
        private String areaOfExpertise;
        private String qualification;
        private Integer yearsOfExperience;
        private String createdAt;
    }
}
