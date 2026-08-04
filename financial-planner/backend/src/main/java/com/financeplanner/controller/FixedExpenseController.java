package com.financeplanner.controller;

import com.financeplanner.entity.FixedExpense;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.FixedExpenseRepository;
import com.financeplanner.repository.TransactionRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/fixed-expenses")
@RequiredArgsConstructor
public class FixedExpenseController {

    private final FixedExpenseRepository fixedExpenseRepo;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<FixedExpense> getAll(@AuthenticationPrincipal User user) {
        return fixedExpenseRepo.findByUserId(user.getId());
    }

    private boolean isDeductionReached(FixedExpense exp, LocalDate today) {
        int day = exp.getDayOfMonth() != null ? exp.getDayOfMonth() : 1;
        return today.getDayOfMonth() >= day;
    }

    @PostMapping
    public FixedExpense create(@RequestBody FixedExpense expense, @AuthenticationPrincipal User user) {
        expense.setUser(user);
        if (expense.getDayOfMonth() == null || expense.getDayOfMonth() < 1) expense.setDayOfMonth(1);
        if (expense.getDayOfMonth() > 30) expense.setDayOfMonth(30);

        FixedExpense saved = fixedExpenseRepo.save(expense);
        
        // Dynamic Sync Logic
        User dbUser = userRepository.findById(user.getId()).orElse(user);
        LocalDate today = LocalDate.now();
        
        if (isDeductionReached(saved, today)) {
            boolean exists = transactionRepository.findByUserId(user.getId()).stream()
                    .anyMatch(t -> t.getFixedExpenseId() != null 
                            && t.getFixedExpenseId().equals(saved.getId())
                            && t.getDate().getMonth() == today.getMonth()
                            && t.getDate().getYear() == today.getYear());
            if (!exists) {
                Transaction expTxn = new Transaction();
                expTxn.setUser(dbUser);
                expTxn.setType(Transaction.TransactionType.EXPENSE);
                expTxn.setCategory(saved.getCategory());
                expTxn.setDescription(saved.getDescription());
                expTxn.setAmount(saved.getAmount());
                expTxn.setDate(today);
                expTxn.setFixedExpenseId(saved.getId());
                transactionRepository.save(expTxn);
            }
        }
        return saved;
    }

    @PutMapping("/{id}")
    public ResponseEntity<FixedExpense> update(@PathVariable Long id, @RequestBody FixedExpense updated, @AuthenticationPrincipal User user) {
        return fixedExpenseRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .map(existing -> {
                    existing.setCategory(updated.getCategory());
                    existing.setAmount(updated.getAmount());
                    existing.setDescription(updated.getDescription());
                    if (updated.getDayOfMonth() != null) {
                        int day = updated.getDayOfMonth();
                        if (day < 1) day = 1;
                        if (day > 30) day = 30;
                        existing.setDayOfMonth(day);
                    }
                    FixedExpense saved = fixedExpenseRepo.save(existing);
                    
                    // Dynamic Sync Logic
                    LocalDate today = LocalDate.now();
                    Optional<Transaction> monthTxn = transactionRepository.findByUserId(user.getId()).stream()
                            .filter(t -> t.getFixedExpenseId() != null 
                                    && t.getFixedExpenseId().equals(saved.getId())
                                    && t.getDate().getMonth() == today.getMonth()
                                    && t.getDate().getYear() == today.getYear())
                            .findFirst();
                            
                    if (isDeductionReached(saved, today)) {
                        if (monthTxn.isPresent()) {
                            Transaction t = monthTxn.get();
                            t.setCategory(saved.getCategory());
                            t.setAmount(saved.getAmount());
                            t.setDescription(saved.getDescription());
                            transactionRepository.save(t);
                        } else {
                            Transaction expTxn = new Transaction();
                            expTxn.setUser(existing.getUser());
                            expTxn.setType(Transaction.TransactionType.EXPENSE);
                            expTxn.setCategory(saved.getCategory());
                            expTxn.setDescription(saved.getDescription());
                            expTxn.setAmount(saved.getAmount());
                            expTxn.setDate(today);
                            expTxn.setFixedExpenseId(saved.getId());
                            transactionRepository.save(expTxn);
                        }
                    } else {
                        // Deduction day is in the future for this month -> delete auto-created transaction if any
                        monthTxn.ifPresent(transactionRepository::delete);
                    }
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return fixedExpenseRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .map(existing -> {
                    fixedExpenseRepo.deleteById(id);
                    
                    // Dynamic Sync Logic
                    LocalDateTime now = LocalDateTime.now();
                    LocalDate today = now.toLocalDate();
                    transactionRepository.findByUserId(user.getId()).stream()
                            .filter(t -> t.getFixedExpenseId() != null 
                                    && t.getFixedExpenseId().equals(id)
                                    && t.getDate().getMonth() == today.getMonth()
                                    && t.getDate().getYear() == today.getYear())
                            .findFirst()
                            .ifPresent(transactionRepository::delete);
                            
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
