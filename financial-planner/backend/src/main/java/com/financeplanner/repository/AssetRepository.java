package com.financeplanner.repository;

import com.financeplanner.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    List<Asset> findByUserId(Long userId);

    @Query("SELECT COALESCE(SUM(a.currentValue), 0) FROM Asset a")
    Double sumAllAssetValues();

    @Query("SELECT COALESCE(SUM(a.currentValue), 0) FROM Asset a WHERE a.user.id = :userId")
    Double sumAssetByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);
}
