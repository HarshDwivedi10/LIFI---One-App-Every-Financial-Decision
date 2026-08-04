package com.financeplanner.controller;

import com.financeplanner.entity.IncomeSource;
import com.financeplanner.entity.User;
import com.financeplanner.repository.IncomeSourceRepository;
import jakarta.validation.Valid;
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

    @GetMapping
    public List<IncomeSource> getAll(@AuthenticationPrincipal User user) {
        return incomeRepo.findByUserId(user.getId());
    }

    @PostMapping
    public IncomeSource create(@RequestBody IncomeSource income, @AuthenticationPrincipal User user) {
        income.setUser(user);
        return incomeRepo.save(income);
    }

    @PutMapping("/{id}")
    public ResponseEntity<IncomeSource> update(@PathVariable Long id, @RequestBody IncomeSource updated, @AuthenticationPrincipal User user) {
        return incomeRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
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
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return incomeRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .map(existing -> {
                    incomeRepo.deleteById(id);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
