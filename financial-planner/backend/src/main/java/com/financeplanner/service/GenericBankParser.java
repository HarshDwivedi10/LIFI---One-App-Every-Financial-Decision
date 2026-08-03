package com.financeplanner.service;

import com.financeplanner.entity.BankTransaction;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
public class GenericBankParser implements BankParserStrategy {

    @Override
    public boolean supports(String senderEmail, String subject) {
        // Fallback parser for generic transaction emails
        return subject.toLowerCase().contains("transaction") || 
               subject.toLowerCase().contains("payment");
    }

    @Override
    public BankTransaction parse(Document emailDocument) {
        BankTransaction transaction = new BankTransaction();
        String text = emailDocument.text();
        
        // Very basic placeholder extraction logic
        if (text.toLowerCase().contains("debited")) {
            transaction.setTransactionType(BankTransaction.TransactionType.DEBIT);
        } else if (text.toLowerCase().contains("credited")) {
            transaction.setTransactionType(BankTransaction.TransactionType.CREDIT);
        }
        
        transaction.setTransactionAmount(new BigDecimal("0.00")); // Placeholder
        transaction.setBankName("Generic Bank");
        transaction.setTransactionDate(LocalDateTime.now());
        
        return transaction;
    }
}
