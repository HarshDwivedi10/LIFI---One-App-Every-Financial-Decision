package com.financeplanner.controller;

import com.financeplanner.dto.GoalImpactResponse;
import com.financeplanner.dto.GoalSimulationRequest;
import com.financeplanner.entity.User;
import com.financeplanner.service.GoalImpactService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/goal-impact")
@RequiredArgsConstructor
public class GoalImpactController {

    private final GoalImpactService goalImpactService;

    @PostMapping("/simulate")
    public ResponseEntity<GoalImpactResponse> simulate(
            @AuthenticationPrincipal User user,
            @RequestBody GoalSimulationRequest request) {
        return ResponseEntity.ok(goalImpactService.simulate(user, request));
    }

    @PostMapping("/purchase")
    public ResponseEntity<GoalImpactResponse> simulatePurchase(
            @AuthenticationPrincipal User user,
            @RequestBody GoalSimulationRequest request) {
        request.setType(GoalSimulationRequest.SimulationType.ONE_TIME_PURCHASE);
        return ResponseEntity.ok(goalImpactService.simulate(user, request));
    }

    @PostMapping("/salary")
    public ResponseEntity<GoalImpactResponse> simulateSalaryChange(
            @AuthenticationPrincipal User user,
            @RequestBody GoalSimulationRequest request) {
        request.setType(GoalSimulationRequest.SimulationType.SALARY_CHANGE);
        return ResponseEntity.ok(goalImpactService.simulate(user, request));
    }

    @PostMapping("/retirement")
    public ResponseEntity<GoalImpactResponse> simulateRetirementChange(
            @AuthenticationPrincipal User user,
            @RequestBody GoalSimulationRequest request) {
        request.setType(GoalSimulationRequest.SimulationType.RETIREMENT_AGE_CHANGE);
        return ResponseEntity.ok(goalImpactService.simulate(user, request));
    }

    @PostMapping("/delete-goal")
    public ResponseEntity<GoalImpactResponse> simulateDeleteGoal(
            @AuthenticationPrincipal User user,
            @RequestBody GoalSimulationRequest request) {
        request.setType(GoalSimulationRequest.SimulationType.DELETE_GOAL);
        return ResponseEntity.ok(goalImpactService.simulate(user, request));
    }
}
