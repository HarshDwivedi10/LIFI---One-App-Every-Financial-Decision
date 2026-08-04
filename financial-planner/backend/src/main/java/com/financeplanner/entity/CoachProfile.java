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
}
