package com.financeplanner.controller;

import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionRepository txnRepo;
    private final com.financeplanner.service.BankStatementService bankStatementService;
    private final com.financeplanner.service.ReconciliationService reconciliationService;

    @GetMapping
    public List<Transaction> getAll(@AuthenticationPrincipal User user) {
        return txnRepo.findByUserIdOrderByDateDesc(user.getId());
    }

    @PostMapping
    public Transaction create(@RequestBody Transaction transaction, @AuthenticationPrincipal User user) {
        transaction.setUser(user);
        return txnRepo.save(transaction);
    }

    @PostMapping("/bulk")
    public List<Transaction> createBulk(@RequestBody List<Transaction> transactions, @AuthenticationPrincipal User user) {
        transactions.forEach(t -> t.setUser(user));
        return txnRepo.saveAll(transactions);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Transaction> update(@PathVariable Long id, @RequestBody Transaction updated, @AuthenticationPrincipal User user) {
        return txnRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .map(existing -> {
                    existing.setDate(updated.getDate());
                    existing.setType(updated.getType());
                    existing.setCategory(updated.getCategory());
                    existing.setAmount(updated.getAmount());
                    existing.setDescription(updated.getDescription());
                    return ResponseEntity.ok(txnRepo.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return txnRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .map(existing -> {
                    txnRepo.deleteById(id);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadStatement(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, user);
            List<Transaction> saved = txnRepo.saveAll(parsed);
            log.info("Imported {} transactions from file: {}", saved.size(), file.getOriginalFilename());
            return ResponseEntity.ok(Map.of(
                    "imported", saved.size(),
                    "transactions", saved
            ));
        } catch (Exception e) {
            log.error("Statement import failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to parse statement: " + e.getMessage()));
        }
    }

    @PostMapping("/reconcile-statement")
    public ResponseEntity<?> uploadAndReconcile(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, user);
            List<Transaction> saved = txnRepo.saveAll(parsed);
            
            // Trigger Reconciliation Engine
            Map<String, Object> result = reconciliationService.reconcileMonth(user, saved);
            result.put("imported", saved.size());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Statement reconciliation failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to reconcile statement: " + e.getMessage()));
        }
    }
}
