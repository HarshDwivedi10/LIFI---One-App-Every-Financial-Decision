package com.financeplanner.service;

import com.financeplanner.entity.BankTransaction;
import com.financeplanner.entity.User;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class GmailSyncService {

    private final EmailParserService parserService;
    private final TransactionService transactionService;
    private final GmailAuthService authService;

    public GmailSyncService(EmailParserService parserService, 
                            TransactionService transactionService,
                            GmailAuthService authService) {
        this.parserService = parserService;
        this.transactionService = transactionService;
        this.authService = authService;
    }

    public void syncTransactions(User user) {
        // Placeholder for Gmail API integration
        // 1. Get user's Gmail tokens from authService
        // 2. Initialize Gmail API client
        // 3. Search messages (e.g., query="subject:transaction")
        // 4. Loop through messages
        
        // Mock iteration
        String mockSender = "alerts@genericbank.com";
        String mockSubject = "Transaction Alert";
        String mockHtml = "<html><body>Your account was debited by $50.00.</body></html>";
        String mockMessageId = "mock-message-12345";
        
        Optional<BankTransaction> parsedOpt = parserService.parseEmail(mockSender, mockSubject, mockHtml);
        
        parsedOpt.ifPresent(transaction -> {
            transaction.setUser(user);
            transaction.setMessageId(mockMessageId);
            transactionService.saveParsedTransaction(transaction);
        });
    }
}
