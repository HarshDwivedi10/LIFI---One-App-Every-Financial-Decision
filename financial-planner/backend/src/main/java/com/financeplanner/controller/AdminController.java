package com.financeplanner.controller;

import com.financeplanner.dto.AdminDashboardDTO;
import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.service.AdminDashboardService;
import com.financeplanner.service.CoachManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminDashboardService adminDashboardService;
    private final CoachManagementService coachManagementService;

    // ──────────────────── DASHBOARD ────────────────────

    @GetMapping("/dashboard")
    public ResponseEntity<AdminDashboardDTO> getDashboard() {
        return ResponseEntity.ok(adminDashboardService.getDashboard());
    }

    // ──────────────────── COACH MANAGEMENT ────────────────────

    @GetMapping("/coaches")
    public ResponseEntity<List<CoachDetailDTO>> getAllCoaches() {
        return ResponseEntity.ok(coachManagementService.getAllCoaches());
    }

    @GetMapping("/coaches/{userId}")
    public ResponseEntity<CoachDetailDTO> getCoachDetail(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.getCoachByUserId(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/coaches/filter")
    public ResponseEntity<?> filterCoaches(@RequestParam String status) {
        try {
            return ResponseEntity.ok(coachManagementService.filterByStatus(status));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/coaches/search")
    public ResponseEntity<List<CoachDetailDTO>> searchCoaches(@RequestParam String keyword) {
        return ResponseEntity.ok(coachManagementService.searchCoaches(keyword));
    }

    @PutMapping("/coaches/{userId}/approve")
    public ResponseEntity<?> approveCoach(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.approveCoach(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/coaches/{userId}/reject")
    public ResponseEntity<?> rejectCoach(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.rejectCoach(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/coaches/{userId}/suspend")
    public ResponseEntity<?> suspendCoach(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.suspendCoach(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/coaches/{userId}/activate")
    public ResponseEntity<?> activateCoach(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(coachManagementService.activateCoach(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/coaches/{userId}")
    public ResponseEntity<?> deleteCoach(@PathVariable Long userId) {
        try {
            coachManagementService.deleteCoach(userId);
            return ResponseEntity.ok(Map.of("message", "Coach deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ──────────────────── USER MANAGEMENT ────────────────────

    private final com.financeplanner.service.UserManagementService userManagementService;

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, defaultValue = "ALL") String role,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(userManagementService.getUsers(keyword, role, status, page, size));
    }

    @PutMapping("/users/{userId}/assign-coach")
    public ResponseEntity<?> assignCoach(@PathVariable Long userId, @RequestParam Long coachId) {
        try {
            return ResponseEntity.ok(userManagementService.assignCoach(userId, coachId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{userId}/remove-coach")
    public ResponseEntity<?> removeCoach(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userManagementService.removeCoach(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{userId}/change-role")
    public ResponseEntity<?> changeRole(@PathVariable Long userId, @RequestParam String newRole) {
        try {
            return ResponseEntity.ok(userManagementService.changeRole(userId, newRole));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{userId}/suspend")
    public ResponseEntity<?> suspendUser(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userManagementService.suspendUser(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{userId}/activate")
    public ResponseEntity<?> activateUser(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userManagementService.activateUser(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId) {
        try {
            userManagementService.deleteUser(userId);
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
