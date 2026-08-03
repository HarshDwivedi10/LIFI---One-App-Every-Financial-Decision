package com.financeplanner.controller;

import com.financeplanner.entity.User;
import com.financeplanner.service.FinancialProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class FinancialProfileController {

    private final FinancialProfileService profileService;

    @GetMapping("/summary")
    public Map<String, Object> getSummary(@AuthenticationPrincipal User user) {
        return profileService.getFinancialSummary(user.getId());
    }
}
