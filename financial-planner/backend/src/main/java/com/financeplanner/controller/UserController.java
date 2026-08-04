package com.financeplanner.controller;

import com.financeplanner.entity.User;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings(@AuthenticationPrincipal User user) {
        User dbUser = userRepository.findById(user.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("salaryDay", dbUser.getSalaryDay() != null ? dbUser.getSalaryDay() : 1);
        response.put("salaryTime", dbUser.getSalaryTime() != null ? dbUser.getSalaryTime() : "00:00");
        response.put("manualTotalSavings", dbUser.getManualTotalSavings() != null ? dbUser.getManualTotalSavings() : 0.0);
        response.put("fundAllocationsJson", dbUser.getFundAllocationsJson() != null ? dbUser.getFundAllocationsJson() : "{}");
        return ResponseEntity.ok(response);
    }

    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@AuthenticationPrincipal User user, @RequestBody Map<String, Object> payload) {
        User dbUser = userRepository.findById(user.getId()).orElse(null);
        if (dbUser == null) return ResponseEntity.notFound().build();
        
        if (payload.containsKey("salaryDay")) {
            dbUser.setSalaryDay(Integer.parseInt(payload.get("salaryDay").toString()));
        }
        if (payload.containsKey("salaryTime")) {
            dbUser.setSalaryTime(payload.get("salaryTime").toString());
        }
        if (payload.containsKey("manualTotalSavings")) {
            dbUser.setManualTotalSavings(Double.parseDouble(payload.get("manualTotalSavings").toString()));
        }
        if (payload.containsKey("fundAllocationsJson")) {
            dbUser.setFundAllocationsJson(payload.get("fundAllocationsJson").toString());
        }
        
        userRepository.save(dbUser);
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Settings updated successfully");
        response.put("salaryDay", dbUser.getSalaryDay() != null ? dbUser.getSalaryDay() : 1);
        response.put("salaryTime", dbUser.getSalaryTime() != null ? dbUser.getSalaryTime() : "00:00");
        response.put("manualTotalSavings", dbUser.getManualTotalSavings() != null ? dbUser.getManualTotalSavings() : 0.0);
        response.put("fundAllocationsJson", dbUser.getFundAllocationsJson() != null ? dbUser.getFundAllocationsJson() : "{}");
        return ResponseEntity.ok(response);
    }
}
