package com.financeplanner.controller;

import com.financeplanner.dto.FundGoalDTO;
import com.financeplanner.dto.FundGoalResponseDTO;
import com.financeplanner.entity.Asset;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.UserResolverService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetRepository assetRepo;
    private final UserRepository userRepo;
    private final UserResolverService userResolverService;

    @GetMapping
    public List<Asset> getAll(@AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return assetRepo.findByUserId(effectiveUser.getId());
    }

    @PostMapping
    public Asset create(@RequestBody Asset asset, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        User dbUser = userRepo.findById(effectiveUser.getId()).orElse(effectiveUser);
        asset.setUser(dbUser);
        return assetRepo.save(asset);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Asset> update(@PathVariable Long id, @RequestBody Asset updated, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return assetRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    existing.setName(updated.getName());
                    existing.setAssetType(updated.getAssetType());
                    existing.setCurrentValue(updated.getCurrentValue());
                    existing.setFundAllocations(updated.getFundAllocations());
                    return ResponseEntity.ok(assetRepo.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return assetRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(effectiveUser.getId()))
                .map(existing -> {
                    assetRepo.deleteById(id);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public static class ReconcileRequest {
        public String fundType;
        public double adjustmentAmount;
    }

    @PostMapping("/reconcile-discrepancy")
    public ResponseEntity<Asset> reconcileDiscrepancy(@RequestBody ReconcileRequest req, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        Asset asset = assetRepo.findByUserId(effectiveUser.getId()).stream()
                .filter(a -> req.fundType.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.fundType.equals("UNALLOCATED") ? "Unallocated Savings" : req.fundType + " Corpus";
                    return Asset.builder().user(effectiveUser).name(name).assetType(req.fundType).currentValue(0.0).build();
                });
        
        asset.setCurrentValue(asset.getCurrentValue() + req.adjustmentAmount);
        
        // Clear discrepancy source
        User dbUser = userRepo.findById(effectiveUser.getId()).orElse(effectiveUser);
        dbUser.setLastDiscrepancySource(null);
        userRepo.save(dbUser);
        
        return ResponseEntity.ok(assetRepo.save(asset));
    }

    public static class TransferRequest {
        public String sourceFund;
        public String destinationFund;
        public double amount;
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transferFunds(@RequestBody TransferRequest req, @AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        if (req.amount <= 0) {
            return ResponseEntity.badRequest().body("Transfer amount must be greater than zero.");
        }
        if (req.sourceFund.equals(req.destinationFund)) {
            return ResponseEntity.badRequest().body("Source and destination funds cannot be the same.");
        }

        Asset sourceAsset = assetRepo.findByUserId(effectiveUser.getId()).stream()
                .filter(a -> req.sourceFund.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.sourceFund.equals("UNALLOCATED") ? "Unallocated Savings" : req.sourceFund + " Corpus";
                    return assetRepo.save(Asset.builder().user(effectiveUser).name(name).assetType(req.sourceFund).currentValue(0.0).build());
                });

        Asset destAsset = assetRepo.findByUserId(effectiveUser.getId()).stream()
                .filter(a -> req.destinationFund.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.destinationFund.equals("UNALLOCATED") ? "Unallocated Savings" : req.destinationFund + " Corpus";
                    return assetRepo.save(Asset.builder().user(effectiveUser).name(name).assetType(req.destinationFund).currentValue(0.0).build());
                });

        if (sourceAsset.getCurrentValue() < req.amount) {
            return ResponseEntity.badRequest().body("Insufficient balance in source fund.");
        }

        sourceAsset.setCurrentValue(sourceAsset.getCurrentValue() - req.amount);
        destAsset.setCurrentValue(destAsset.getCurrentValue() + req.amount);

        assetRepo.save(sourceAsset);
        assetRepo.save(destAsset);

        return ResponseEntity.ok("Transfer successful");
    }

    /**
     * Pure calculation endpoint — no DB writes.
     * Computes required monthly contribution, feasibility, and projected date
     * for a new fund goal based on the user's available monthly savings.
     */
    @PostMapping("/calculate-fund-goal")
    public ResponseEntity<FundGoalResponseDTO> calculateFundGoal(@RequestBody FundGoalDTO req) {
        double targetAmount = req.getTargetAmount() != null ? req.getTargetAmount() : 0;
        double expectedMonthlySavings = req.getExpectedMonthlySavings() != null ? req.getExpectedMonthlySavings() : 0;
        double alreadyAllocatedPct = req.getAlreadyAllocatedPct() != null ? req.getAlreadyAllocatedPct() : 0;

        // Parse target date
        LocalDate targetDate;
        try {
            targetDate = LocalDate.parse(req.getTargetDate());
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }

        LocalDate today = LocalDate.now();
        long monthsRemaining = ChronoUnit.MONTHS.between(today, targetDate);
        if (monthsRemaining < 1) monthsRemaining = 1;

        // Step 1: Required monthly contribution
        double requiredMonthlyContrib = Math.ceil(targetAmount / monthsRemaining);

        // Step 2: Available savings
        double remainingPct = Math.max(0, 100.0 - alreadyAllocatedPct);
        double remainingMonthlySavings = expectedMonthlySavings * (remainingPct / 100.0);

        // Step 3: Required % of monthly savings
        double requiredPct = 0;
        if (expectedMonthlySavings > 0) {
            requiredPct = (requiredMonthlyContrib / expectedMonthlySavings) * 100.0;
        }

        // Step 4: Suggested allocation % (clamped to remaining)
        double suggestedPct = Math.min(requiredPct, remainingPct);

        // Step 5: Feasibility
        boolean feasible = requiredMonthlyContrib <= remainingMonthlySavings + 0.01; // small epsilon for floating point

        FundGoalResponseDTO.FundGoalResponseDTOBuilder builder = FundGoalResponseDTO.builder()
                .monthsRemaining(monthsRemaining)
                .requiredMonthlyContrib(Math.ceil(requiredMonthlyContrib))
                .requiredPct(Math.round(requiredPct * 100.0) / 100.0)
                .suggestedPct(Math.round(suggestedPct * 100.0) / 100.0)
                .remainingMonthlySavings(Math.round(remainingMonthlySavings))
                .remainingPct(remainingPct)
                .feasible(feasible)
                .shortfallMonthly(0)
                .projectedDate("")
                .projectedMonths(0);

        if (!feasible && remainingMonthlySavings > 0) {
            double shortfall = requiredMonthlyContrib - remainingMonthlySavings;
            long projectedMonths = (long) Math.ceil(targetAmount / remainingMonthlySavings);
            LocalDate projectedDate = today.plusMonths(projectedMonths);
            builder.shortfallMonthly(Math.ceil(shortfall))
                   .projectedMonths(projectedMonths)
                   .projectedDate(projectedDate.toString());
        } else if (!feasible) {
            // No savings available at all
            builder.shortfallMonthly(Math.ceil(requiredMonthlyContrib));
        }

        return ResponseEntity.ok(builder.build());
    }
}
