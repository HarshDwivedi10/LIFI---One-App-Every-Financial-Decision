package com.financeplanner.controller;

import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.repository.TransactionRepository;
import com.financeplanner.service.UserResolverService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionRepository txnRepo;
    private final com.financeplanner.service.BankStatementService bankStatementService;
    private final com.financeplanner.service.ReconciliationService reconciliationService;
    private final UserResolverService userResolverService;
    private final com.financeplanner.service.SavingsCalculationService savingsCalculationService;

    @GetMapping
    public List<Transaction> getAll(@AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return txnRepo.findByUserIdOrderByDateDesc(effectiveUser.getId());
    }

    @PostMapping
    public Transaction create(@RequestBody Transaction transaction, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        transaction.setUser(effectiveUser);
        Transaction[] saved = new Transaction[1];
        savingsCalculationService.trackDiscrepancyOperation(effectiveUser, "Added a transaction", () -> {
            saved[0] = txnRepo.save(transaction);
        });
        return saved[0];
    }

    @PostMapping("/bulk")
    public List<Transaction> createBulk(@RequestBody List<Transaction> transactions, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        transactions.forEach(t -> t.setUser(effectiveUser));
        return txnRepo.saveAll(transactions);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Transaction> update(@PathVariable Long id, @RequestBody Transaction updated, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return txnRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    existing.setDate(updated.getDate());
                    existing.setType(updated.getType());
                    existing.setCategory(updated.getCategory());
                    existing.setAmount(updated.getAmount());
                    existing.setDescription(updated.getDescription());
                    Transaction[] saved = new Transaction[1];
                    savingsCalculationService.trackDiscrepancyOperation(effectiveUser, "Modified a past transaction", () -> {
                        saved[0] = txnRepo.save(existing);
                    });
                    return ResponseEntity.ok(saved[0]);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return txnRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    savingsCalculationService.trackDiscrepancyOperation(effectiveUser, "Deleted a transaction", () -> {
                        txnRepo.deleteById(id);
                    });
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Autowired
    private com.financeplanner.repository.MonthlyStatementVerificationRepository verificationRepository;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadStatement(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, effectiveUser);
            List<Transaction> saved = txnRepo.saveAll(parsed);
            return ResponseEntity.ok(Map.of("imported", saved.size(), "transactions", saved));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed: " + e.getMessage()));
        }
    }

    @PostMapping("/parse-csv-preview")
    public ResponseEntity<?> parseCsvPreview(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "year", required = false) Integer year,
            @RequestParam(value = "month", required = false) Integer month,
            @AuthenticationPrincipal User user,
            HttpServletRequest request
    ) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        try {
            List<Transaction> parsed = bankStatementService.parseStatement(file, effectiveUser);
            
            // If year and month were passed, filter matching transactions if available
            List<Transaction> filtered = parsed;
            if (year != null && month != null) {
                List<Transaction> byMonth = parsed.stream()
                        .filter(t -> t.getDate() != null && t.getDate().getYear() == year && t.getDate().getMonthValue() == month)
                        .collect(Collectors.toList());
                if (!byMonth.isEmpty()) {
                    filtered = byMonth;
                }
            }

            double csvIncome = filtered.stream()
                    .filter(t -> t.getType() == Transaction.TransactionType.INCOME || t.getType() == Transaction.TransactionType.CREDIT)
                    .mapToDouble(Transaction::getAmount).sum();

            double csvExpense = filtered.stream()
                    .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE || t.getType() == Transaction.TransactionType.DEBIT)
                    .mapToDouble(Transaction::getAmount).sum();

            List<Map<String, Object>> txnList = filtered.stream().map(t -> {
                Map<String, Object> map = new HashMap<>();
                map.put("date", t.getDate() != null ? t.getDate().toString() : "");
                map.put("description", t.getDescription() != null ? t.getDescription() : "Transaction");
                map.put("type", t.getType() != null ? t.getType().name() : "EXPENSE");
                map.put("amount", t.getAmount());
                map.put("category", t.getCategory() != null ? t.getCategory() : "Other");
                return map;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "csvIncome", csvIncome,
                    "csvExpense", csvExpense,
                    "totalCount", filtered.size(),
                    "transactions", txnList
            ));
        } catch (Exception e) {
            log.error("Failed to parse statement preview", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Parsing failed: " + e.getMessage()));
        }
    }

    @PostMapping("/save-verification")
    public ResponseEntity<?> saveVerification(@RequestBody com.financeplanner.dto.VerificationRequestDto req, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        try {
            Map<String, Object> result = reconciliationService.executeVerification(effectiveUser, req);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Verification save failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Verification failed: " + e.getMessage()));
        }
    }

    @GetMapping("/verification-status")
    public ResponseEntity<?> getVerificationStatus(@RequestParam int year, @RequestParam int month, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return verificationRepository.findByUserIdAndYearAndMonth(effectiveUser.getId(), year, month)
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
