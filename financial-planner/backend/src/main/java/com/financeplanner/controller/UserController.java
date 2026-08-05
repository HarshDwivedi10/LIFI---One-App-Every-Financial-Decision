package com.financeplanner.controller;

import com.financeplanner.dto.CoachSuggestionDTO;
import com.financeplanner.dto.PendingEditDTO;
import com.financeplanner.entity.User;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.CoachService;
import com.financeplanner.service.SavingsCalculationService;
import com.financeplanner.service.FixedExpenseAdjustmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final SavingsCalculationService savingsCalculationService;
    private final FixedExpenseAdjustmentService fixedExpenseAdjustmentService;
    private final CoachService coachService;
    private final com.financeplanner.service.UserResolverService userResolverService;

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings(@AuthenticationPrincipal User user, jakarta.servlet.http.HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        User dbUser = userRepository.findById(effectiveUser.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("salaryDay", dbUser.getSalaryDay() != null ? dbUser.getSalaryDay() : 1);
        response.put("salaryTime", dbUser.getSalaryTime() != null ? dbUser.getSalaryTime() : "00:00");
        response.put("manualTotalSavings", dbUser.getManualTotalSavings() != null ? dbUser.getManualTotalSavings() : 0.0);
        response.put("preExistingSavingsDate", dbUser.getPreExistingSavingsDate());
        response.put("liveTotalSavings", savingsCalculationService.calculateLiveTotalSavings(dbUser));
        response.put("fundAllocationsJson", dbUser.getFundAllocationsJson() != null ? dbUser.getFundAllocationsJson() : "{}");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/savings-breakdown")
    public ResponseEntity<Map<String, Object>> getSavingsBreakdown(@AuthenticationPrincipal User user, jakarta.servlet.http.HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        User dbUser = userRepository.findById(effectiveUser.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(savingsCalculationService.getSavingsBreakdown(dbUser));
    }

    @GetMapping("/fund-balances")
    public ResponseEntity<Map<String, Object>> getFundBalances(@AuthenticationPrincipal User user, jakarta.servlet.http.HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        User dbUser = userRepository.findById(effectiveUser.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(savingsCalculationService.getFundBalances(dbUser));
    }

    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@AuthenticationPrincipal User user, @RequestBody Map<String, Object> payload) {
        User dbUser = userRepository.findById(user.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        
        boolean manualSavingsChanged = false;
        boolean salaryDayChanged = false;
        
        if (payload.containsKey("salaryDay")) {
            int newDay = Integer.parseInt(payload.get("salaryDay").toString());
            if (dbUser.getSalaryDay() == null || dbUser.getSalaryDay() != newDay) {
                dbUser.setSalaryDay(newDay);
                salaryDayChanged = true;
            }
        }
        if (payload.containsKey("salaryTime")) {
            dbUser.setSalaryTime(payload.get("salaryTime").toString());
        }
        if (payload.containsKey("manualTotalSavings")) {
            dbUser.setManualTotalSavings(Double.parseDouble(payload.get("manualTotalSavings").toString()));
            manualSavingsChanged = true;
        }
        if (payload.containsKey("preExistingSavingsDate")) {
            dbUser.setPreExistingSavingsDate(payload.get("preExistingSavingsDate").toString());
        }
        if (payload.containsKey("fundAllocationsJson")) {
            dbUser.setFundAllocationsJson(payload.get("fundAllocationsJson").toString());
            manualSavingsChanged = true;
        }
        
        userRepository.save(dbUser);
        
        if (salaryDayChanged) {
            fixedExpenseAdjustmentService.adjustFixedExpensesForDateChange(dbUser, dbUser.getSalaryDay());
        }

        if (manualSavingsChanged || dbUser.getManualTotalSavings() != null) {
            savingsCalculationService.syncPreExistingAssets(dbUser, dbUser.getManualTotalSavings());
        }

        Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Settings updated successfully");
        response.put("salaryDay", dbUser.getSalaryDay() != null ? dbUser.getSalaryDay() : 1);
        response.put("salaryTime", dbUser.getSalaryTime() != null ? dbUser.getSalaryTime() : "00:00");
        response.put("manualTotalSavings", dbUser.getManualTotalSavings() != null ? dbUser.getManualTotalSavings() : 0.0);
        response.put("preExistingSavingsDate", dbUser.getPreExistingSavingsDate());
        response.put("liveTotalSavings", savingsCalculationService.calculateLiveTotalSavings(dbUser));
        response.put("fundAllocationsJson", dbUser.getFundAllocationsJson() != null ? dbUser.getFundAllocationsJson() : "{}");
        return ResponseEntity.ok(response);
    }

    // ──────────────────── COACH PERMISSIONS & SUGGESTIONS ────────────────────

    @GetMapping("/coach-permission")
    public ResponseEntity<Map<String, String>> getCoachPermission(@AuthenticationPrincipal User user) {
        String perm = coachService.getCoachPermission(user.getId());
        return ResponseEntity.ok(Map.of("permission", perm));
    }

    @PutMapping("/coach-permission")
    public ResponseEntity<Map<String, String>> updateCoachPermission(@AuthenticationPrincipal User user, @RequestBody Map<String, String> payload) {
        String permReq = payload.get("permission");
        String updated = coachService.updateCoachPermission(user.getId(), permReq);
        return ResponseEntity.ok(Map.of("permission", updated, "message", "Coach permission updated to " + updated));
    }

    @GetMapping("/coach-suggestions")
    public ResponseEntity<List<CoachSuggestionDTO>> getCoachSuggestions(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coachService.getCoachSuggestions(user.getId()));
    }

    @GetMapping("/pending-edits")
    public ResponseEntity<List<PendingEditDTO>> getPendingEdits(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coachService.getPendingEdits(user.getId()));
    }

    @PutMapping("/pending-edits/{id}/accept")
    public ResponseEntity<?> acceptPendingEdit(@AuthenticationPrincipal User user, @PathVariable Long id) {
        try {
            coachService.acceptPendingEdit(user.getId(), id);
            return ResponseEntity.ok(Map.of("message", "Proposed edit accepted and applied successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/pending-edits/{id}/reject")
    public ResponseEntity<?> rejectPendingEdit(@AuthenticationPrincipal User user, @PathVariable Long id) {
        try {
            coachService.rejectPendingEdit(user.getId(), id);
            return ResponseEntity.ok(Map.of("message", "Proposed edit rejected"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
