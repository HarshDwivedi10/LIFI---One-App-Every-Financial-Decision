package com.financeplanner.controller;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.entity.User;
import com.financeplanner.service.CoachService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coaches")
@RequiredArgsConstructor
public class PublicCoachController {

    private final CoachService coachService;

    @GetMapping
    public ResponseEntity<List<CoachDetailDTO>> getActiveCoaches(@AuthenticationPrincipal User user) {
        Long userId = (user != null) ? user.getId() : null;
        return ResponseEntity.ok(coachService.getActiveCoachesForUser(userId));
    }

    @PostMapping("/{coachId}/hire")
    public ResponseEntity<?> hireCoach(@AuthenticationPrincipal User user, @PathVariable Long coachId) {
        try {
            coachService.hireCoach(user.getId(), coachId);
            return ResponseEntity.ok(Map.of("message", "Successfully hired financial coach!"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
