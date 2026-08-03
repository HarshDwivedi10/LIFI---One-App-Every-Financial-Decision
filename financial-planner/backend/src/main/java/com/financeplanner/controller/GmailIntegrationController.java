package com.financeplanner.controller;

import com.financeplanner.dto.OAuthUrlResponse;
import com.financeplanner.dto.SyncStatusResponse;
import com.financeplanner.entity.User;
import com.financeplanner.service.GmailAuthService;
import com.financeplanner.service.GmailSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gmail")
public class GmailIntegrationController {

    private final GmailAuthService authService;
    private final GmailSyncService syncService;

    public GmailIntegrationController(GmailAuthService authService, GmailSyncService syncService) {
        this.authService = authService;
        this.syncService = syncService;
    }

    @GetMapping("/auth-url")
    public ResponseEntity<OAuthUrlResponse> getAuthUrl() {
        String url = authService.generateAuthorizationUrl();
        return ResponseEntity.ok(new OAuthUrlResponse(url));
    }

    @PostMapping("/callback")
    public ResponseEntity<String> handleCallback(@RequestParam String code) {
        // In a real application, get the authenticated User from SecurityContext
        User mockUser = new User();
        mockUser.setId(1L);
        
        authService.handleCallback(mockUser, code);
        return ResponseEntity.ok("Successfully authenticated with Gmail");
    }

    @PostMapping("/sync")
    public ResponseEntity<SyncStatusResponse> triggerSync() {
        // In a real application, get the authenticated User from SecurityContext
        User mockUser = new User();
        mockUser.setId(1L);
        
        // This should ideally be asynchronous
        syncService.syncTransactions(mockUser);
        
        SyncStatusResponse response = new SyncStatusResponse();
        response.setSyncing(true);
        response.setStatusMessage("Sync triggered successfully");
        
        return ResponseEntity.ok(response);
    }
}
