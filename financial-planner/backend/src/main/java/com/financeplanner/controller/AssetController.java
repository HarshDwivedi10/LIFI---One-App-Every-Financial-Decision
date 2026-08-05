package com.financeplanner.controller;

import com.financeplanner.entity.Asset;
import com.financeplanner.entity.User;
import com.financeplanner.entity.FundTransfer;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.FundTransferRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.UserResolverService;
import jakarta.servlet.http.HttpServletRequest;
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

        sourceAsset.setCurrentValue(sourceAsset.getCurrentValue() - req.amount);
        destAsset.setCurrentValue(destAsset.getCurrentValue() + req.amount);

        assetRepo.save(sourceAsset);
        assetRepo.save(destAsset);

        FundTransfer transferLog = FundTransfer.builder()
                .user(effectiveUser)
                .sourceFund(req.sourceFund)
                .destinationFund(req.destinationFund)
                .amount(req.amount)
                .build();
        transferRepo.save(transferLog);

        return ResponseEntity.ok("Transfer successful");
    }

    @GetMapping("/transfers")
    public ResponseEntity<List<FundTransfer>> getTransfers(@AuthenticationPrincipal User user, HttpServletRequest request) {
        User effectiveUser = userResolverService.getEffectiveUser(user, request);
        return ResponseEntity.ok(transferRepo.findByUserIdOrderByDateDesc(effectiveUser.getId()));
    }
}
