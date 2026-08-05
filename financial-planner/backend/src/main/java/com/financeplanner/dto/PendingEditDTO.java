package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PendingEditDTO {
    private Long id;
    private String coachName;
    private String entityType;
    private String description;
    private String payloadJson;
    private String status;
    private String createdAt;
}
