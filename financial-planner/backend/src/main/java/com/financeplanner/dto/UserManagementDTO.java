package com.financeplanner.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserManagementDTO {
    private Long id;
    private String name;
    private String email;
    private String phone;
    private String registrationDate;
    private String role;
    private String status;

    private Long assignedCoachId;
    private String assignedCoachName;

    private Double totalIncome;
    private Double totalExpenses;
    private Double totalAssets;
    private Long goalCount;

    private String coachPermission;
}
