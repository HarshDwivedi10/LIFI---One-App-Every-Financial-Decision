package com.financeplanner.controller;

import com.financeplanner.entity.Asset;
import com.financeplanner.entity.User;
import com.financeplanner.entity.FundTransfer;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.FundTransferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetRepository assetRepo;
    private final FundTransferRepository transferRepo;
    private final com.financeplanner.repository.UserRepository userRepo;

    @GetMapping
    public List<Asset> getAll(@AuthenticationPrincipal User user) {
        return assetRepo.findByUserId(user.getId());
    }

    @PostMapping
    public Asset create(@RequestBody Asset asset, @AuthenticationPrincipal User user) {
        User dbUser = userRepo.findById(user.getId()).orElse(user);
        asset.setUser(dbUser);
        return assetRepo.save(asset);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Asset> update(@PathVariable Long id, @RequestBody Asset updated, @AuthenticationPrincipal User user) {
        return assetRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
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
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return assetRepo.findById(id)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
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
    public ResponseEntity<Asset> reconcileDiscrepancy(@RequestBody ReconcileRequest req, @AuthenticationPrincipal User user) {
        Asset asset = assetRepo.findByUserId(user.getId()).stream()
                .filter(a -> req.fundType.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.fundType.equals("UNALLOCATED") ? "Unallocated Savings" : req.fundType + " Corpus";
                    return Asset.builder().user(user).name(name).assetType(req.fundType).currentValue(0.0).build();
                });
        
        asset.setCurrentValue(asset.getCurrentValue() + req.adjustmentAmount);
        return ResponseEntity.ok(assetRepo.save(asset));
    }

    public static class TransferRequest {
        public String sourceFund;
        public String destinationFund;
        public double amount;
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transferFunds(@RequestBody TransferRequest req, @AuthenticationPrincipal User user) {
        if (req.amount <= 0) {
            return ResponseEntity.badRequest().body("Transfer amount must be greater than zero.");
        }
        if (req.sourceFund.equals(req.destinationFund)) {
            return ResponseEntity.badRequest().body("Source and destination funds cannot be the same.");
        }

        // Fetch or create source asset
        Asset sourceAsset = assetRepo.findByUserId(user.getId()).stream()
                .filter(a -> req.sourceFund.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.sourceFund.equals("UNALLOCATED") ? "Unallocated Savings" : req.sourceFund + " Corpus";
                    return assetRepo.save(Asset.builder().user(user).name(name).assetType(req.sourceFund).currentValue(0.0).build());
                });

        // Validation is strictly handled by the frontend which calculates the TRUE total balance 
        // across all distributed JSON allocations. Here we allow the dedicated asset to go negative 
        // to act as a debit ledger entry against the total pool.

        // Fetch or create destination asset
        Asset destAsset = assetRepo.findByUserId(user.getId()).stream()
                .filter(a -> req.destinationFund.equals(a.getAssetType()))
                .findFirst()
                .orElseGet(() -> {
                    String name = req.destinationFund.equals("UNALLOCATED") ? "Unallocated Savings" : req.destinationFund + " Corpus";
                    return assetRepo.save(Asset.builder().user(user).name(name).assetType(req.destinationFund).currentValue(0.0).build());
                });

        // Apply transfer
        sourceAsset.setCurrentValue(sourceAsset.getCurrentValue() - req.amount);
        destAsset.setCurrentValue(destAsset.getCurrentValue() + req.amount);

        assetRepo.save(sourceAsset);
        assetRepo.save(destAsset);

        // Record transfer
        FundTransfer transferLog = FundTransfer.builder()
                .user(user)
                .sourceFund(req.sourceFund)
                .destinationFund(req.destinationFund)
                .amount(req.amount)
                .build();
        transferRepo.save(transferLog);

        return ResponseEntity.ok("Transfer successful");
    }

    @GetMapping("/transfers")
    public ResponseEntity<List<FundTransfer>> getTransfers(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(transferRepo.findByUserIdOrderByDateDesc(user.getId()));
    }
}
