package com.financeplanner.service;

import com.financeplanner.entity.BankTransaction;
import org.jsoup.nodes.Document;

public interface BankParserStrategy {
    boolean supports(String senderEmail, String subject);
    BankTransaction parse(Document emailDocument);
}
