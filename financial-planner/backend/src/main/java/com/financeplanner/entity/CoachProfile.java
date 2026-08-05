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

    private String title;

    private String location;

    @Column(name = "years_experience")
    private String yearsExperience;

    private Double rating;

    @Column(name = "client_count")
    private String clientCount;

    @Column(name = "about_me", columnDefinition = "LONGTEXT")
    private String aboutMe;

    @Column(columnDefinition = "LONGTEXT")
    private String expertise;

    @Column(name = "profile_picture_base64", columnDefinition = "LONGTEXT")
    private String profilePictureBase64;

    @Column(name = "consultation_fee")
    private Double consultationFee;

    private String phone;

    private String linkedIn;

    @Column(name = "professional_summary", columnDefinition = "LONGTEXT")
    private String professionalSummary;

    @Column(name = "experience_details", columnDefinition = "LONGTEXT")
    private String experienceDetails;

    @Column(name = "education_details", columnDefinition = "LONGTEXT")
    private String educationDetails;
}
