package com.financeplanner.service.parser;

import com.financeplanner.dto.ParsedTransactionDto;
import com.opencsv.CSVReader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class CsvBankStatementParser implements BankStatementParser {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy")
    );

    @Override
    public boolean supports(MultipartFile file) {
        String filename = file.getOriginalFilename();
        return filename != null && filename.toLowerCase().endsWith(".csv");
    }

    @Override
    public List<ParsedTransactionDto> parse(MultipartFile file) throws Exception {
        List<ParsedTransactionDto> transactions = new ArrayList<>();
        
        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            List<String[]> allRows = reader.readAll();
            if (allRows.isEmpty()) {
                return transactions;
            }

            // Heuristic detection of header columns
            int dateCol = -1;
            int descCol = -1;
            int debitCol = -1;
            int creditCol = -1;
            int amountCol = -1;
            int balanceCol = -1;
            
            int dataStartRow = 0;

            // Find header row and column indices
            for (int i = 0; i < Math.min(20, allRows.size()); i++) {
                String[] row = allRows.get(i);
                boolean foundHeader = false;
                
                for (int j = 0; j < row.length; j++) {
                    String cell = row[j].trim().toLowerCase();
                    if (cell.contains("date")) { dateCol = j; foundHeader = true; }
                    else if (cell.contains("desc") || cell.contains("particular") || cell.contains("detail")) { descCol = j; foundHeader = true; }
                    else if (cell.equals("debit") || cell.equals("dr") || cell.contains("withdrawal")) { debitCol = j; foundHeader = true; }
                    else if (cell.equals("credit") || cell.equals("cr") || cell.contains("deposit")) { creditCol = j; foundHeader = true; }
                    else if (cell.contains("amount") && debitCol == -1 && creditCol == -1) { amountCol = j; foundHeader = true; }
                    else if (cell.contains("balance")) { balanceCol = j; foundHeader = true; }
                }
                
                if (foundHeader && dateCol != -1) {
                    dataStartRow = i + 1;
                    break;
                }
            }

            // If no headers found, fallback to old parser assuming (Date, Type, Category, Amount, Desc)
            if (dateCol == -1) {
                return fallbackParse(allRows);
            }

            for (int i = dataStartRow; i < allRows.size(); i++) {
                String[] row = allRows.get(i);
                if (row.length <= Math.max(dateCol, Math.max(descCol, Math.max(debitCol, Math.max(creditCol, amountCol))))) {
                    continue; // Skip invalid rows
                }

                try {
                    String dateStr = row[dateCol].trim();
                    LocalDate date = parseDate(dateStr);
                    if (date == null) continue; // Not a valid transaction row

                    String description = descCol != -1 ? row[descCol].trim() : "";
                    
                    Double debit = 0.0;
                    Double credit = 0.0;
                    Double balance = null;

                    if (debitCol != -1 && debitCol < row.length) {
                        debit = parseAmount(row[debitCol]);
                    }
                    if (creditCol != -1 && creditCol < row.length) {
                        credit = parseAmount(row[creditCol]);
                    }
                    if (amountCol != -1 && amountCol < row.length) {
                        double amt = parseAmount(row[amountCol]);
                        if (amt < 0) {
                            debit = Math.abs(amt);
                        } else {
                            credit = amt;
                        }
                    }
                    if (balanceCol != -1 && balanceCol < row.length) {
                        balance = parseAmount(row[balanceCol]);
                        if (balance == 0.0) balance = null; // empty column
                    }

                    if (debit == 0.0 && credit == 0.0) {
                        continue; // skip rows without transaction amount
                    }

                    transactions.add(ParsedTransactionDto.builder()
                            .date(date)
                            .description(description)
                            .debitAmount(debit)
                            .creditAmount(credit)
                            .balance(balance)
                            .build());
                } catch (Exception e) {
                    log.debug("Skipping unparseable CSV row {}: {}", i, String.join(",", row));
                }
            }
        }
        return transactions;
    }

    private List<ParsedTransactionDto> fallbackParse(List<String[]> allRows) {
        List<ParsedTransactionDto> transactions = new ArrayList<>();
        // Fallback assumes Date, Type, Category, Amount, Desc
        for (int i = 1; i < allRows.size(); i++) {
            String[] row = allRows.get(i);
            if (row.length < 4) continue;
            try {
                LocalDate date = parseDate(row[0].trim());
                if (date == null) continue;
                String typeStr = row[1].trim().toUpperCase();
                double amount = parseAmount(row[3]);
                String desc = row.length > 4 ? row[4].trim() : "";
                
                Double debit = 0.0;
                Double credit = 0.0;
                if (typeStr.contains("CREDIT") || typeStr.contains("INCOME")) {
                    credit = amount;
                } else {
                    debit = amount;
                }
                
                transactions.add(ParsedTransactionDto.builder()
                        .date(date)
                        .description(desc)
                        .debitAmount(debit)
                        .creditAmount(credit)
                        .build());
            } catch (Exception e) {
                // ignore
            }
        }
        return transactions;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) return null;
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(dateStr.trim(), fmt);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private Double parseAmount(String amountStr) {
        if (amountStr == null || amountStr.trim().isEmpty()) return 0.0;
        // Remove commas, currency symbols, and spaces
        String clean = amountStr.replaceAll("[^0-9.-]", "");
        if (clean.isEmpty() || clean.equals("-")) return 0.0;
        try {
            return Double.parseDouble(clean);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
