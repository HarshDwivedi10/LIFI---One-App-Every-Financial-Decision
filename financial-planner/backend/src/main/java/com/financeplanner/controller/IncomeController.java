package com.financeplanner.controller;

import com.financeplanner.entity.IncomeSource;
import com.financeplanner.entity.User;
import com.financeplanner.repository.IncomeSourceRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.UserResolverService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/income")
@RequiredArgsConstructor
public class IncomeController {

    private final IncomeSourceRepository incomeRepo;
    private final UserRepository userRepository;
    private final UserResolverService userResolverService;

    @GetMapping
    public List<IncomeSource> getAll(@AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return incomeRepo.findByUserId(effectiveUser.getId());
    }

    @PostMapping
    public IncomeSource create(@RequestBody IncomeSource income, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        User dbUser = userRepository.findById(effectiveUser.getId()).orElse(effectiveUser);
        income.setUser(dbUser);
        return incomeRepo.save(income);
    }

    @PutMapping("/{id}")
    public ResponseEntity<IncomeSource> update(@PathVariable Long id, @RequestBody IncomeSource updated, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return incomeRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    existing.setType(updated.getType());
                    existing.setAmount(updated.getAmount());
                    existing.setDescription(updated.getDescription());
                    existing.setDayOfMonth(updated.getDayOfMonth() != null ? updated.getDayOfMonth() : 1);
                    return ResponseEntity.ok(incomeRepo.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return incomeRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    incomeRepo.deleteById(id);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
