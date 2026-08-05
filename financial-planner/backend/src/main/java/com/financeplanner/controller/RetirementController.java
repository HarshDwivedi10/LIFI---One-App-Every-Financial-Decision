package com.financeplanner.controller;

import com.financeplanner.entity.RetirementPlan;
import com.financeplanner.entity.User;
import com.financeplanner.repository.RetirementPlanRepository;
import com.financeplanner.service.RetirementCalculationService;
import com.financeplanner.service.UserResolverService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/retirement")
@RequiredArgsConstructor
public class RetirementController {

    private final RetirementPlanRepository planRepo;
    private final RetirementCalculationService calcService;
    private final UserResolverService userResolverService;

    @PostMapping("/calculate")
    public ResponseEntity<Map<String, Object>> calculate(@RequestBody RetirementPlan plan, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        try {
            plan.setUser(effectiveUser);
            Map<String, Object> result = calcService.calculate(plan);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Calculation failed: " + e.getMessage()));
        }
    }

    @GetMapping("/plan")
    public ResponseEntity<RetirementPlan> getLatestPlan(@AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        Optional<RetirementPlan> plan = planRepo.findTopByUserIdOrderByUpdatedAtDesc(effectiveUser.getId());
        return plan.map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/plan")
    public ResponseEntity<RetirementPlan> savePlan(@RequestBody RetirementPlan plan, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        plan.setUser(effectiveUser);
        return ResponseEntity.ok(planRepo.save(plan));
    }
}
