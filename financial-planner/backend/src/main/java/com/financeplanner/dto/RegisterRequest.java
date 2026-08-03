package com.financeplanner.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    private String role; // "USER" or "COACH"

    // Coach specific fields
    private String qualification;
    private String highestEducation;
    private Integer yearsOfExperience;
    private String certifications;
    private String areaOfExpertise;
    private String phoneNumber;
    private String address;
    private String bio;
}
