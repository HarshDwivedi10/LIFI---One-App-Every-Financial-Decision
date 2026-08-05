package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CoachSuggestionDTO {
    private Long id;
    private String coachName;
    private String category;
    private String suggestionText;
    private String createdAt;
}
