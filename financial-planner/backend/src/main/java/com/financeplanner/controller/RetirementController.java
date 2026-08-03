package com.financeplanner.controller;

import com.financeplanner.entity.RetirementPlan;
import com.financeplanner.entity.User;
import com.financeplanner.repository.RetirementPlanRepository;
import com.financeplanner.service.RetirementCalculationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/retirement")
@RequiredArgsConstructor
public class RetirementController {

    private final RetirementPlanRepository planRepo;
    private final RetirementCalculationService calcService;

    @PostMapping("/calculate")
    public ResponseEntity<Map<String, Object>> calculate(@RequestBody RetirementPlan plan, @AuthenticationPrincipal User user) {
        try {
            plan.setUser(user);
            Map<String, Object> result = calcService.calculate(plan);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Calculation failed: " + e.getMessage()));
        }
    }

    @GetMapping("/plan")
    public ResponseEntity<RetirementPlan> getLatestPlan(@AuthenticationPrincipal User user) {
        // Need to fetch for user. Assuming we want the latest for THIS user.
        // We need a method in repo for this.
        // Using a temporary workaround if repo doesn't have it, but repo has findTopByOrderByUpdatedAtDesc.
        // Let's assume we want to get the latest plan for the specific user. 
        // We will need to update RetirementPlanRepository to have findTopByUserIdOrderByUpdatedAtDesc(Long userId).
        // I will do that in the next step.
        Optional<RetirementPlan> plan = planRepo.findTopByUserIdOrderByUpdatedAtDesc(user.getId());
        return plan.map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/plan")
    public ResponseEntity<RetirementPlan> savePlan(@RequestBody RetirementPlan plan, @AuthenticationPrincipal User user) {
        plan.setUser(user);
        return ResponseEntity.ok(planRepo.save(plan));
    }
}
