package com.financeplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SyncStatusResponse {
    private boolean isSyncing;
    private String statusMessage;
    private LocalDateTime lastSyncTime;
    private int emailsProcessed;
    private int transactionsFound;
}
