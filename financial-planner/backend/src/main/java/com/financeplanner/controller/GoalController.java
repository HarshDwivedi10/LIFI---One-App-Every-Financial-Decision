package com.financeplanner.controller;

import com.financeplanner.entity.Goal;
import com.financeplanner.entity.User;
import com.financeplanner.repository.GoalRepository;
import com.financeplanner.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/goals")
@CrossOrigin(origins = "http://localhost:5173")
public class GoalController {

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<Goal>> getGoals(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(goalRepository.findByUser(user));
    }

    @PostMapping
    public ResponseEntity<Goal> createGoal(@RequestBody Goal goal, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        goal.setUser(user);
        if (goal.getIsDelayed() == null) goal.setIsDelayed(false);
        if (goal.getAcknowledged() == null) goal.setAcknowledged(true);
        
        Goal savedGoal = goalRepository.save(goal);
        return ResponseEntity.ok(savedGoal);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGoal(@PathVariable Long id, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Goal> goalOpt = goalRepository.findById(id);
        if (goalOpt.isPresent() && goalOpt.get().getUser().getId().equals(user.getId())) {
            goalRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Goal> updateGoal(@PathVariable Long id, @RequestBody Goal updatedGoal, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Goal> goalOpt = goalRepository.findById(id);
        if (goalOpt.isPresent() && goalOpt.get().getUser().getId().equals(user.getId())) {
            Goal goal = goalOpt.get();
            goal.setName(updatedGoal.getName());
            goal.setCost(updatedGoal.getCost());
            goal.setCategory(updatedGoal.getCategory());
            goal.setTargetDate(updatedGoal.getTargetDate());
            goal.setMonthlyAllocation(updatedGoal.getMonthlyAllocation());
            // isDelayed and acknowledged are handled by reconciliation or acknowledge endpoint usually
            Goal savedGoal = goalRepository.save(goal);
            return ResponseEntity.ok(savedGoal);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/acknowledge")
    public ResponseEntity<Goal> acknowledgeGoal(@PathVariable Long id, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Goal> goalOpt = goalRepository.findById(id);
        if (goalOpt.isPresent() && goalOpt.get().getUser().getId().equals(user.getId())) {
            Goal goal = goalOpt.get();
            goal.setAcknowledged(true);
            goal.setIsDelayed(false); // Reset the delayed flag once acknowledged
            Goal savedGoal = goalRepository.save(goal);
            return ResponseEntity.ok(savedGoal);
        }
        return ResponseEntity.notFound().build();
    }
}
