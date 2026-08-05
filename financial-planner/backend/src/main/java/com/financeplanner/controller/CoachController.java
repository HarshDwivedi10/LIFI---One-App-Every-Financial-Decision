package com.financeplanner.controller;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.dto.CoachSuggestionDTO;
import com.financeplanner.dto.PendingEditDTO;
import com.financeplanner.dto.UserManagementDTO;
import com.financeplanner.entity.User;
import com.financeplanner.service.CoachService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coach")
@RequiredArgsConstructor
public class CoachController {

    private final CoachService coachService;

    @GetMapping("/users")
    public ResponseEntity<List<UserManagementDTO>> getAssignedUsers(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coachService.getAssignedUsers(user.getId()));
    }

    @GetMapping("/profile")
    public ResponseEntity<CoachDetailDTO> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coachService.getProfile(user.getId()));
    }

    @PutMapping("/profile")
    public ResponseEntity<CoachDetailDTO> updateProfile(@AuthenticationPrincipal User user, @RequestBody CoachDetailDTO request) {
        return ResponseEntity.ok(coachService.updateProfile(user.getId(), request));
    }

    @PostMapping("/suggestions")
    public ResponseEntity<CoachSuggestionDTO> postSuggestion(@AuthenticationPrincipal User coach, @RequestBody Map<String, Object> payload) {
        Long targetUserId = Long.parseLong(payload.get("targetUserId").toString());
        String text = payload.get("suggestionText").toString();
        String category = payload.containsKey("category") ? payload.get("category").toString() : "General Advice";
        return ResponseEntity.ok(coachService.postCoachSuggestion(coach.getId(), targetUserId, text, category));
    }

    @PostMapping("/propose-edit")
    public ResponseEntity<PendingEditDTO> proposeEdit(@AuthenticationPrincipal User coach, @RequestBody Map<String, Object> payload) {
        Long targetUserId = Long.parseLong(payload.get("targetUserId").toString());
        String entityType = payload.get("entityType").toString();
        String description = payload.get("description").toString();
        String payloadJson = payload.containsKey("payloadJson") ? payload.get("payloadJson").toString() : "{}";
        return ResponseEntity.ok(coachService.proposeEdit(coach.getId(), targetUserId, entityType, description, payloadJson));
    }
}
