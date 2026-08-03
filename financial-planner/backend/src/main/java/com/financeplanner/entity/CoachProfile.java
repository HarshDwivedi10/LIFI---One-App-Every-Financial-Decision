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

    private String qualification;

    @Column(name = "highest_education")
    private String highestEducation;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    private String certifications;

    @Column(name = "area_of_expertise")
    private String areaOfExpertise;

    @Column(name = "phone_number")
    private String phoneNumber;

    private String address;

    @Column(columnDefinition = "TEXT")
    private String bio;
}
