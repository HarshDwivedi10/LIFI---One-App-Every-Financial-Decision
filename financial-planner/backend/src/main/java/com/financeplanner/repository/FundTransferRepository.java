package com.financeplanner.repository;

import com.financeplanner.entity.FundTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FundTransferRepository extends JpaRepository<FundTransfer, Long> {
    List<FundTransfer> findByUserIdOrderByDateDesc(Long userId);
}
