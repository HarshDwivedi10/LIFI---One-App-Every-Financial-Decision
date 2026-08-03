package com.financeplanner.service;

import com.financeplanner.entity.BankTransaction;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class EmailParserService {

    private final List<BankParserStrategy> strategies;

    public EmailParserService(List<BankParserStrategy> strategies) {
        this.strategies = strategies;
    }

    public Optional<BankTransaction> parseEmail(String senderEmail, String subject, String htmlBody) {
        Document document = Jsoup.parse(htmlBody);

        for (BankParserStrategy strategy : strategies) {
            if (strategy.supports(senderEmail, subject)) {
                try {
                    return Optional.of(strategy.parse(document));
                } catch (Exception e) {
                    // Log parsing error for this specific strategy
                    System.err.println("Error parsing with strategy: " + strategy.getClass().getSimpleName());
                }
            }
        }
        
        return Optional.empty();
    }
}
