package com.financeplanner.service;

import com.financeplanner.dto.ParsedTransactionDto;
import com.financeplanner.entity.Transaction;
import com.financeplanner.entity.User;
import com.financeplanner.service.parser.BankStatementParser;
import com.financeplanner.service.parser.ParserFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BankStatementService {

    private final ParserFactory parserFactory;

    /**
     * Parses a bank statement (PDF or CSV) and converts to a list of Transaction entities.
     * The transactions are NOT saved to the database here.
     */
    public List<Transaction> parseStatement(MultipartFile file, User user) throws Exception {
        BankStatementParser parser = parserFactory.getParser(file);
        log.info("Using parser {} for file {}", parser.getClass().getSimpleName(), file.getOriginalFilename());
        
        List<ParsedTransactionDto> parsedDtos = parser.parse(file);
        log.info("Parsed {} transactions from file {}", parsedDtos.size(), file.getOriginalFilename());
        
        return parsedDtos.stream().map(dto -> mapToEntity(dto, user)).collect(Collectors.toList());
    }

    private Transaction mapToEntity(ParsedTransactionDto dto, User user) {
        Transaction.TransactionType type;
        double amount;

        double credit = dto.getCreditAmount() != null ? dto.getCreditAmount() : 0.0;
        double debit = dto.getDebitAmount() != null ? dto.getDebitAmount() : 0.0;

        if (credit > 0 && debit == 0) {
            type = Transaction.TransactionType.INCOME;
            amount = credit;
        } else if (debit > 0 && credit == 0) {
            type = Transaction.TransactionType.EXPENSE;
            amount = debit;
        } else if (credit > 0) {
            type = Transaction.TransactionType.INCOME;
            amount = credit;
        } else {
            type = Transaction.TransactionType.EXPENSE;
            amount = debit;
        }

        // Basic categorization heuristic
        String category = "Other";
        String desc = dto.getDescription() != null ? dto.getDescription().toLowerCase() : "";
        if (desc.contains("amazon") || desc.contains("flipkart") || desc.contains("shopping") || desc.contains("myntra")) {
            category = "Shopping";
        } else if (desc.contains("uber") || desc.contains("ola") || desc.contains("irctc") || desc.contains("ticket") || desc.contains("flight") || desc.contains("petrol") || desc.contains("fuel")) {
            category = "Travel";
        } else if (desc.contains("zomato") || desc.contains("swiggy") || desc.contains("restaurant") || desc.contains("food") || desc.contains("cafe") || desc.contains("dine")) {
            category = "Food";
        } else if (desc.contains("salary") || desc.contains("payroll") || desc.contains("wages") || desc.contains("dividend")) {
            category = "Salary";
        } else if (desc.contains("atm") || desc.contains("cash")) {
            category = "Cash";
        } else if (desc.contains("electric") || desc.contains("water") || desc.contains("recharge") || desc.contains("wifi") || desc.contains("bill")) {
            category = "Utilities";
        }

        return Transaction.builder()
                .user(user)
                .date(dto.getDate())
                .description(dto.getDescription())
                .amount(amount)
                .type(type)
                .category(category)
                .build();
    }
}
