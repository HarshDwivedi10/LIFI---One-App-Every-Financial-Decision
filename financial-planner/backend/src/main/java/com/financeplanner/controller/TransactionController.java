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
import org.springframework.beans.factory.annotation.Autowired;

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

    @Autowired
    private com.financeplanner.repository.MonthlyStatementVerificationRepository verificationRepository;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadStatement(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        // We'll keep this endpoint for backwards compatibility or direct transaction import if needed.
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, user);
            List<Transaction> saved = txnRepo.saveAll(parsed);
            return ResponseEntity.ok(Map.of("imported", saved.size(), "transactions", saved));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed: " + e.getMessage()));
        }
    }

    @PostMapping("/parse-csv-preview")
    public ResponseEntity<?> parseCsvPreview(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, user);
            
            double csvIncome = parsed.stream()
                .filter(t -> "INCOME".equals(t.getType()) || "CREDIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount).sum();
                
            double csvExpense = parsed.stream()
                .filter(t -> "EXPENSE".equals(t.getType()) || "DEBIT".equals(t.getType()))
                .mapToDouble(Transaction::getAmount).sum();
                
            return ResponseEntity.ok(Map.of(
                "csvIncome", csvIncome,
                "csvExpense", csvExpense
            ));
        } catch (Exception e) {
            log.error("Failed to parse CSV preview", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Parsing failed: " + e.getMessage()));
        }
    }

    @PostMapping("/save-verification")
    public ResponseEntity<?> saveVerification(@RequestBody com.financeplanner.dto.VerificationRequestDto req, @AuthenticationPrincipal User user) {
        try {
            Map<String, Object> result = reconciliationService.executeVerification(user, req);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Verification save failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Verification failed: " + e.getMessage()));
        }
    }

    @GetMapping("/verification-status")
    public ResponseEntity<?> getVerificationStatus(@RequestParam int year, @RequestParam int month, @AuthenticationPrincipal User user) {
        return verificationRepository.findByUserIdAndYearAndMonth(user.getId(), year, month)
                .map(v -> ResponseEntity.ok(Map.of(
                    "isVerified", v.isVerified(),
                    "verifiedIncome", v.getVerifiedIncome(),
                    "verifiedExpense", v.getVerifiedExpense(),
                    "csvIncome", v.getCsvIncome(),
                    "csvExpense", v.getCsvExpense()
                )))
                .orElse(ResponseEntity.ok(Map.of("isVerified", false)));
    }
}
