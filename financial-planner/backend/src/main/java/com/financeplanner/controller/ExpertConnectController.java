package com.financeplanner.controller;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.service.CoachManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public-facing (any authenticated user) endpoints for the "Financial Expert Connect"
 * page, where regular users browse approved coaches and their CVs.
 * Not under /api/admin/** (admin-only) or /api/coach/** (coach-only) so any
 * logged-in user can hit it — see SecurityConfig's anyRequest().authenticated() fallback.
 */
@RestController
@RequestMapping("/api/experts")
@RequiredArgsConstructor
public class ExpertConnectController {

    private final CoachManagementService coachManagementService;

    @GetMapping
    public ResponseEntity<List<CoachDetailDTO>> getActiveExperts() {
        return ResponseEntity.ok(coachManagementService.getActiveCoaches());
    }

    @GetMapping("/{userId}")
    public ResponseEntity<CoachDetailDTO> getExpertDetail(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.getCoachByUserId(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}