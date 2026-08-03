package com.financeplanner.controller;

import com.financeplanner.dto.UserManagementDTO;
import com.financeplanner.entity.User;
import com.financeplanner.service.CoachService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/coach")
@RequiredArgsConstructor
public class CoachController {

    private final CoachService coachService;

    @GetMapping("/users")
    public ResponseEntity<List<UserManagementDTO>> getAssignedUsers(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coachService.getAssignedUsers(user.getId()));
    }
}
