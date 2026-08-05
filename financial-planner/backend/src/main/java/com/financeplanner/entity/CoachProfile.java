package com.financeplanner.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "coach_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CoachProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
    private User user;

    @Column(name = "resume_base64", columnDefinition = "LONGTEXT")
    private String resumeBase64;

    @Column(name = "title")
    private String title;

    @Column(name = "location")
    private String location;

    @Column(name = "phone")
    private String phone;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @Column(name = "rating")
    private Double rating;

    @Column(name = "clients_count")
    private Integer clientsCount;

    @Column(name = "consultation_fee")
    private Double consultationFee;

    @Column(name = "about", columnDefinition = "TEXT")
    private String about;

    @Column(name = "expertise", columnDefinition = "TEXT")
    private String expertise; // comma-separated tags, e.g. "Retirement Planning,Tax Planning"

    @Column(name = "professional_summary", columnDefinition = "TEXT")
    private String professionalSummary;

    // Each entry on its own line, pipe-separated: Title|Company|Period|Description
    @Column(name = "experience_entries", columnDefinition = "TEXT")
    private String experienceEntries;

    // Each entry on its own line, pipe-separated: Degree|Institution|Year
    @Column(name = "education_entries", columnDefinition = "TEXT")
    private String educationEntries;
}