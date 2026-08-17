package com.financeplanner.service.parser;

import com.financeplanner.dto.ParsedTransactionDto;
import com.opencsv.CSVParserBuilder;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class CsvBankStatementParser implements BankStatementParser {

    private static final List<DateTimeFormatter> FORMATTERS = new ArrayList<>();

    static {
        // Build an exhaustive set of case-insensitive date formats
        String[] patterns = {
                "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy",
                "MM/dd/yyyy", "M/d/yyyy", "yyyy/MM/dd", "dd.MM.yyyy", "d.M.yyyy",
                "dd-MMM-yyyy", "d-MMM-yyyy", "dd MMM yyyy", "d MMM yyyy",
                "yyyy/M/d", "yyyy.MM.dd", "dd/MM/yy", "d/M/yy", "dd-MM-yy",
                "d-M-yy", "MM/dd/yy", "M/d/yy", "yy-MM-dd", "dd-MMM-yy", "d-MMM-yy",
                "dd MMM yy", "d MMM yy", "MMMM dd, yyyy", "MMM dd, yyyy", "dd MMMM yyyy",
                "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "dd/MM/yyyy HH:mm:ss", "dd-MM-yyyy HH:mm:ss"
        };
        for (String p : patterns) {
            try {
                FORMATTERS.add(new DateTimeFormatterBuilder()
                        .parseCaseInsensitive()
                        .appendPattern(p)
                        .parseDefaulting(ChronoField.ERA, 1)
                        .toFormatter(Locale.ENGLISH));
            } catch (Exception ignored) {}
        }
    }

    private static final Pattern NUMERIC_PATTERN = Pattern.compile("[-+]?\\d+(?:[.,]\\d+)*");

    @Override
    public boolean supports(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) {
                return true;
            }
        }
        String contentType = file.getContentType();
        return contentType != null && (
                contentType.contains("csv") ||
                contentType.contains("excel") ||
                contentType.contains("text/plain") ||
                contentType.contains("tab-separated")
        );
    }

    @Override
    public List<ParsedTransactionDto> parse(MultipartFile file) throws Exception {
        byte[] bytes = file.getBytes();
        if (bytes.length == 0) return new ArrayList<>();

        // Handle BOM and encodings cleanly
        String content = new String(bytes, StandardCharsets.UTF_8);
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }

        // Auto-detect delimiter: comma, semicolon, tab, pipe
        char delimiter = detectDelimiter(content);
        log.info("[CsvParser] Detected delimiter: '{}' for file {}", delimiter, file.getOriginalFilename());

        List<String[]> allRows = new ArrayList<>();
        try (CSVReader reader = new CSVReaderBuilder(new StringReader(content))
                .withCSVParser(new CSVParserBuilder().withSeparator(delimiter).build())
                .build()) {
            allRows = reader.readAll();
        }

        if (allRows.isEmpty()) {
            // Fallback to plain line splitting if OpenCSV yielded nothing
            String[] lines = content.split("\\r?\\n");
            for (String l : lines) {
                if (!l.trim().isEmpty()) {
                    allRows.add(l.split(String.valueOf(delimiter)));
                }
            }
        }

        log.info("[CsvParser] Total rows read: {}", allRows.size());
        if (allRows.isEmpty()) return new ArrayList<>();

        int dateCol = -1;
        int descCol = -1;
        int debitCol = -1;
        int creditCol = -1;
        int amountCol = -1;
        int typeCol = -1;
        int balanceCol = -1;
        int categoryCol = -1;

        int headerRowIndex = -1;

        // Scan the first 30 rows to find the header row
        for (int i = 0; i < Math.min(30, allRows.size()); i++) {
            String[] row = allRows.get(i);
            int matched = 0;

            for (int j = 0; j < row.length; j++) {
                String raw = row[j] != null ? row[j].trim().toLowerCase() : "";
                String cell = raw.replaceAll("[^a-z0-9/& _-]", "").trim();
                if (cell.isEmpty()) continue;

                if (dateCol == -1 && (cell.equals("date") || cell.contains("txn date") || cell.contains("transaction date") || cell.contains("value date") || cell.contains("posting date"))) {
                    dateCol = j;
                    matched++;
                } else if (descCol == -1 && (cell.contains("desc") || cell.contains("particular") || cell.contains("detail") || cell.contains("narration") || cell.contains("remark") || cell.contains("note") || cell.contains("merchant") || cell.contains("payee"))) {
                    descCol = j;
                    matched++;
                } else if (debitCol == -1 && (cell.equals("debit") || cell.contains("debit") || cell.equals("dr") || cell.contains("withdrawal") || cell.contains("outflow") || cell.contains("spent") || cell.contains("dr amount") || cell.contains("debit amount"))) {
                    debitCol = j;
                    matched++;
                } else if (creditCol == -1 && (cell.equals("credit") || cell.contains("credit") || cell.equals("cr") || cell.contains("deposit") || cell.contains("inflow") || cell.contains("received") || cell.contains("cr amount") || cell.contains("credit amount"))) {
                    creditCol = j;
                    matched++;
                } else if (typeCol == -1 && (cell.equals("type") || cell.contains("txn type") || cell.contains("transaction type") || cell.contains("dr/cr") || cell.contains("d/c") || cell.contains("cr/dr"))) {
                    typeCol = j;
                    matched++;
                } else if (amountCol == -1 && (cell.equals("amount") || cell.contains("txn amount") || cell.contains("transaction amount") || cell.contains("net amount"))) {
                    amountCol = j;
                    matched++;
                } else if (balanceCol == -1 && (cell.contains("balance") || cell.contains("closing bal") || cell.contains("avail bal"))) {
                    balanceCol = j;
                    matched++;
                } else if (categoryCol == -1 && (cell.contains("category") || cell.contains("tag") || cell.contains("expense type"))) {
                    categoryCol = j;
                }
            }

            // A valid header row should at least match 2 key financial columns (e.g. Date + Debit/Credit/Desc/Amount)
            if (matched >= 2 || (dateCol != -1 && (debitCol != -1 || creditCol != -1 || amountCol != -1))) {
                headerRowIndex = i;
                break;
            }
        }

        log.info("[CsvParser] Header index: {}, dateCol: {}, descCol: {}, debitCol: {}, creditCol: {}, amountCol: {}, typeCol: {}",
                headerRowIndex, dateCol, descCol, debitCol, creditCol, amountCol, typeCol);

        int dataStartRow = headerRowIndex != -1 ? headerRowIndex + 1 : 0;
        List<ParsedTransactionDto> transactions = new ArrayList<>();

        for (int i = dataStartRow; i < allRows.size(); i++) {
            String[] row = allRows.get(i);
            if (row == null || row.length == 0) continue;

            // Skip empty rows
            boolean allEmpty = true;
            for (String cell : row) {
                if (cell != null && !cell.trim().isEmpty()) {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) continue;

            try {
                String dateStr = (dateCol != -1 && dateCol < row.length) ? row[dateCol].trim() : "";
                LocalDate date = parseDate(dateStr);
                if (date == null) {
                    // Fallback to today if date could not be parsed but row has valid financial amounts
                    date = LocalDate.now();
                }

                String description = (descCol != -1 && descCol < row.length) ? row[descCol].trim() : "";
                if (description.isEmpty()) {
                    // Look for the first non-numeric text column
                    for (int c = 0; c < row.length; c++) {
                        if (c != dateCol && c != debitCol && c != creditCol && c != amountCol && c != balanceCol) {
                            String val = row[c].trim();
                            if (val.length() > 2 && parseAmount(val) == 0.0) {
                                description = val;
                                break;
                            }
                        }
                    }
                }
                if (description.isEmpty()) description = "Bank Transaction";

                String typeStr = (typeCol != -1 && typeCol < row.length) ? row[typeCol].trim().toUpperCase() : "";

                Double debit = 0.0;
                Double credit = 0.0;
                Double balance = null;

                // 1. Separate Debit & Credit columns
                if (debitCol != -1 && debitCol < row.length) {
                    debit = parseAmount(row[debitCol]);
                }
                if (creditCol != -1 && creditCol < row.length) {
                    credit = parseAmount(row[creditCol]);
                }

                // 2. Single Amount column with optional Type column or sign
                if (debit == 0.0 && credit == 0.0 && amountCol != -1 && amountCol < row.length) {
                    String amtRaw = row[amountCol].trim();
                    double amt = parseAmount(amtRaw);

                    if (amtRaw.startsWith("-") || amtRaw.contains("(") || amtRaw.toLowerCase().contains("dr")) {
                        debit = Math.abs(amt);
                    } else if (typeStr.contains("DR") || typeStr.contains("DEBIT") || typeStr.contains("EXPENSE")) {
                        debit = Math.abs(amt);
                    } else if (typeStr.contains("CR") || typeStr.contains("CREDIT") || typeStr.contains("INCOME")) {
                        credit = Math.abs(amt);
                    } else {
                        // Inspect description
                        String descLower = description.toLowerCase();
                        if (isDebitDescription(descLower)) {
                            debit = Math.abs(amt);
                        } else if (isCreditDescription(descLower)) {
                            credit = Math.abs(amt);
                        } else {
                            // Default positive amount to Expense/Debit unless marked otherwise
                            debit = Math.abs(amt);
                        }
                    }
                }

                // 3. Balance Column
                if (balanceCol != -1 && balanceCol < row.length) {
                    balance = parseAmount(row[balanceCol]);
                    if (balance == 0.0) balance = null;
                }

                // If both debit and credit are 0, check all columns for any numeric value
                if (debit == 0.0 && credit == 0.0) {
                    for (int c = 0; c < row.length; c++) {
                        if (c != dateCol && c != balanceCol) {
                            double val = parseAmount(row[c]);
                            if (val > 0) {
                                if (isCreditDescription(description.toLowerCase())) {
                                    credit = val;
                                } else {
                                    debit = val;
                                }
                                break;
                            }
                        }
                    }
                }

                if (debit == 0.0 && credit == 0.0) continue;

                transactions.add(ParsedTransactionDto.builder()
                        .date(date)
                        .description(description)
                        .debitAmount(debit)
                        .creditAmount(credit)
                        .balance(balance)
                        .build());

            } catch (Exception ex) {
                log.warn("[CsvParser] Skipping row {}: {}", i, ex.getMessage());
            }
        }

        log.info("[CsvParser] Successfully extracted {} transactions!", transactions.size());
        return transactions;
    }

    private char detectDelimiter(String content) {
        String[] sampleLines = content.split("\\r?\\n");
        int commas = 0, semicolons = 0, tabs = 0, pipes = 0;
        int checkLimit = Math.min(10, sampleLines.length);

        for (int i = 0; i < checkLimit; i++) {
            String l = sampleLines[i];
            for (char c : l.toCharArray()) {
                if (c == ',') commas++;
                else if (c == ';') semicolons++;
                else if (c == '\t') tabs++;
                else if (c == '|') pipes++;
            }
        }

        if (semicolons > commas && semicolons > tabs && semicolons > pipes) return ';';
        if (tabs > commas && tabs > semicolons && tabs > pipes) return '\t';
        if (pipes > commas && pipes > semicolons && pipes > tabs) return '|';
        return ',';
    }

    private boolean isDebitDescription(String desc) {
        return desc.contains("dr") || desc.contains("debit") || desc.contains("upi/dr") ||
                desc.contains("transfer to") || desc.contains("paid to") || desc.contains("pos") ||
                desc.contains("atm") || desc.contains("purchase") || desc.contains("withdrawal") ||
                desc.contains("bill") || desc.contains("swiggy") || desc.contains("zomato") ||
                desc.contains("amazon") || desc.contains("flipkart") || desc.contains("rent") ||
                desc.contains("sub") || desc.contains("netflix") || desc.contains("fee");
    }

    private boolean isCreditDescription(String desc) {
        return desc.contains("cr") || desc.contains("credit") || desc.contains("upi/cr") ||
                desc.contains("salary") || desc.contains("transfer from") || desc.contains("received from") ||
                desc.contains("deposit") || desc.contains("refund") || desc.contains("interest") ||
                desc.contains("dividend") || desc.contains("freelance") || desc.contains("inflow");
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) return null;
        String clean = dateStr.trim().replaceAll("[\"']", "");

        // Strip time component if present e.g. "2026-08-01 12:00:00" -> "2026-08-01"
        if (clean.contains(" ") && clean.matches(".*\\d{1,2}:\\d{2}.*")) {
            clean = clean.split(" ")[0].trim();
        }

        // Try standard formatters
        for (DateTimeFormatter fmt : FORMATTERS) {
            try {
                return LocalDate.parse(clean, fmt);
            } catch (Exception ignored) {}
        }

        // Try regex extraction for YYYY-MM-DD or DD-MM-YYYY
        Pattern p1 = Pattern.compile("(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})");
        Matcher m1 = p1.matcher(clean);
        if (m1.find()) {
            try {
                return LocalDate.of(Integer.parseInt(m1.group(1)), Integer.parseInt(m1.group(2)), Integer.parseInt(m1.group(3)));
            } catch (Exception ignored) {}
        }

        Pattern p2 = Pattern.compile("(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4}|\\d{2})");
        Matcher m2 = p2.matcher(clean);
        if (m2.find()) {
            try {
                int day = Integer.parseInt(m2.group(1));
                int month = Integer.parseInt(m2.group(2));
                int yr = Integer.parseInt(m2.group(3));
                if (yr < 100) yr += 2000;
                // If month > 12, swap day and month (e.g. MM/DD/YYYY)
                if (month > 12 && day <= 12) {
                    int tmp = day; day = month; month = tmp;
                }
                return LocalDate.of(yr, month, day);
            } catch (Exception ignored) {}
        }

        return null;
    }

    private Double parseAmount(String amountStr) {
        if (amountStr == null || amountStr.trim().isEmpty()) return 0.0;
        String clean = amountStr.trim().replaceAll("[₹$€, ]", "").replaceAll("[\"']", "");
        if (clean.isEmpty() || clean.equals("-") || clean.equals(".")) return 0.0;

        // Handle parenthesis negative numbers: (2450.00) -> 2450.00
        if (clean.startsWith("(") && clean.endsWith(")")) {
            clean = clean.substring(1, clean.length() - 1);
        }

        Matcher m = NUMERIC_PATTERN.matcher(clean);
        if (m.find()) {
            try {
                return Double.parseDouble(m.group(0).replace(",", ""));
            } catch (NumberFormatException ignored) {}
        }
        return 0.0;
    }
}
