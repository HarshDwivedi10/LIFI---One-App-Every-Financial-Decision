package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

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
}
