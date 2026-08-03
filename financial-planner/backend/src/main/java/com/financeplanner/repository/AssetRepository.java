package com.financeplanner.repository;

import com.financeplanner.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    java.util.List<Asset> findByUserId(Long userId);
}
