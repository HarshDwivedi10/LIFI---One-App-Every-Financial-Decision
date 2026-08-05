package com.financeplanner.mapper;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.User;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class CoachProfileMapper {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private CoachProfileMapper() {
    }

    public static CoachDetailDTO toDetailDTO(CoachProfile cp) {
        User u = cp.getUser();
        return CoachDetailDTO.builder()
                .userId(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .status(u.getStatus() != null ? u.getStatus().name() : "PENDING")
                .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().format(DATE_FMT) : "-")
                .profileId(cp.getId())
                .resumeBase64(cp.getResumeBase64())
                .title(cp.getTitle())
                .location(cp.getLocation())
                .phone(cp.getPhone())
                .linkedinUrl(cp.getLinkedinUrl())
                .yearsExperience(cp.getYearsExperience())
                .rating(cp.getRating())
                .clientsCount(cp.getClientsCount())
                .consultationFee(cp.getConsultationFee())
                .about(cp.getAbout())
                .expertise(parseExpertise(cp.getExpertise()))
                .professionalSummary(cp.getProfessionalSummary())
                .experience(parseExperience(cp.getExperienceEntries()))
                .education(parseEducation(cp.getEducationEntries()))
                .build();
    }

    private static List<String> parseExpertise(String raw) {
        List<String> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) return result;
        for (String tag : raw.split(",")) {
            String cleaned = tag.trim()
                    .replaceAll("^\\[+", "")   // strip leading [
                    .replaceAll("\\]+$", "")   // strip trailing ]
                    .replaceAll("^\"+", "")    // strip leading "
                    .replaceAll("\"+$", "")    // strip trailing "
                    .trim();
            if (!cleaned.isEmpty()) result.add(cleaned);
        }
        return result;
    }

    private static List<CoachDetailDTO.ExperienceEntry> parseExperience(String raw) {
        List<CoachDetailDTO.ExperienceEntry> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) return result;
        for (String line : raw.split("\\r?\\n")) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\\|", -1);
            result.add(CoachDetailDTO.ExperienceEntry.builder()
                    .title(parts.length > 0 ? parts[0].trim() : "")
                    .company(parts.length > 1 ? parts[1].trim() : "")
                    .period(parts.length > 2 ? parts[2].trim() : "")
                    .description(parts.length > 3 ? parts[3].trim() : "")
                    .build());
        }
        return result;
    }

    private static List<CoachDetailDTO.EducationEntry> parseEducation(String raw) {
        List<CoachDetailDTO.EducationEntry> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) return result;
        for (String line : raw.split("\\r?\\n")) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\\|", -1);
            result.add(CoachDetailDTO.EducationEntry.builder()
                    .degree(parts.length > 0 ? parts[0].trim() : "")
                    .institution(parts.length > 1 ? parts[1].trim() : "")
                    .year(parts.length > 2 ? parts[2].trim() : "")
                    .build());
        }
        return result;
    }
}
