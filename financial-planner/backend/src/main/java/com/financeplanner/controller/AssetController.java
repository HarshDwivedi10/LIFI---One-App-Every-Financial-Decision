package com.financeplanner.controller;

import com.financeplanner.entity.Asset;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
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

    @GetMapping
    public List<Asset> getAll(@AuthenticationPrincipal User user) {
        return assetRepo.findByUserId(user.getId());
    }

    @PostMapping
    public Asset create(@RequestBody Asset asset, @AuthenticationPrincipal User user) {
        asset.setUser(user);
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
}
