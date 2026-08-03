package com.financeplanner.service;

import com.financeplanner.entity.Transaction;
import com.opencsv.CSVReader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Basic CSV parser.
 * Expected columns: date, type, category, amount, description
 * Date formats accepted: yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy
 */
@Slf4j
@Service
public class CsvParserService {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    public List<Transaction> parseCsv(MultipartFile file) throws Exception {
        List<Transaction> transactions = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            String[] headers = reader.readNext(); // skip header row
            String[] row;

            while ((row = reader.readNext()) != null) {
                if (row.length < 4) continue;

                try {
                    String dateStr = row[0].trim();
                    String typeStr = row[1].trim().toUpperCase();
                    String category = row.length > 2 ? row[2].trim() : "Other";
                    double amount = Double.parseDouble(row[3].trim().replaceAll("[^0-9.]", ""));
                    String description = row.length > 4 ? row[4].trim() : "";

                    Transaction.TransactionType type;
                    try {
                        type = Transaction.TransactionType.valueOf(typeStr);
                    } catch (IllegalArgumentException e) {
                        // Auto-detect based on keyword
                        type = typeStr.contains("CREDIT") || typeStr.contains("INCOME")
                                ? Transaction.TransactionType.INCOME
                                : Transaction.TransactionType.EXPENSE;
                    }

                    LocalDate date = parseDate(dateStr);

                    Transaction txn = Transaction.builder()
                            .date(date)
                            .type(type)
                            .category(category)
                            .amount(amount)
                            .description(description)
                            .build();

                    transactions.add(txn);
                } catch (Exception e) {
                    log.warn("Skipping unparseable CSV row: {}", String.join(",", row));
                }
            }
        }

        return transactions;
    }

    private LocalDate parseDate(String dateStr) {
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(dateStr, fmt);
            } catch (Exception ignored) {}
        }
        log.warn("Could not parse date: {}. Defaulting to today.", dateStr);
        return LocalDate.now();
    }
}
