package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CoachDetailDTO {

    // User fields
    private Long userId;
    private String name;
    private String email;
    private String status;
    private String createdAt;

    // Coach profile fields
    private Long profileId;
    private String resumeBase64;

    private String title;
    private String location;
    private String phone;
    private String linkedinUrl;
    private Integer yearsExperience;
    private Double rating;
    private Integer clientsCount;
    private Double consultationFee;
    private String about;
    private List<String> expertise;
    private String professionalSummary;
    private List<ExperienceEntry> experience;
    private List<EducationEntry> education;

    @Data
    @Builder
    public static class ExperienceEntry {
        private String title;
        private String company;
        private String period;
        private String description;
    }

    @Data
    @Builder
    public static class EducationEntry {
        private String degree;
        private String institution;
        private String year;
    }
}