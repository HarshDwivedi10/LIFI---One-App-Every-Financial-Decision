package com.financeplanner.service.parser;

import com.financeplanner.dto.ParsedTransactionDto;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class PdfBankStatementParser implements BankStatementParser {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy")
    );

    // Common bank statement regex: Date (e.g. 12/03/2023) followed by Description and some numbers
    // E.g., "12/03/2023 AMAZON PURCHASE 100.50 500.00"
    private static final Pattern TRANSACTION_PATTERN = Pattern.compile("^(\\d{2}[-/\\s][A-Za-z0-9]{2,3}[-/\\s]\\d{2,4})\\s+(.+)$");

    @Override
    public boolean supports(MultipartFile file) {
        String filename = file.getOriginalFilename();
        return filename != null && filename.toLowerCase().endsWith(".pdf");
    }

    @Override
    public List<ParsedTransactionDto> parse(MultipartFile file) throws Exception {
        List<ParsedTransactionDto> transactions = new ArrayList<>();
        
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String text = stripper.getText(document);
            
            String[] lines = text.split("\\r?\\n");
            
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty()) continue;
                
                Matcher matcher = TRANSACTION_PATTERN.matcher(line);
                if (matcher.find()) {
                    String dateStr = matcher.group(1).trim();
                    LocalDate date = parseDate(dateStr);
                    if (date == null) continue;

                    String remainder = matcher.group(2).trim();
                    
                    // Extract amounts from the end of the line
                    // Amounts are typically in the format: 1,000.00 or 100.50 or -50.00
                    String[] tokens = remainder.split("\\s+");
                    
                    List<Double> amounts = new ArrayList<>();
                    int descEndIndex = tokens.length;
                    
                    // Look at the last few tokens to see if they are amounts
                    for (int i = tokens.length - 1; i >= 0; i--) {
                        String token = tokens[i];
                        Double amount = parseAmount(token);
                        if (amount != null) {
                            amounts.add(0, amount); // insert at beginning to maintain order
                            descEndIndex = i;
                        } else {
                            break; // found the description part
                        }
                    }
                    
                    if (amounts.isEmpty()) continue; // No amounts found
                    
                    StringBuilder descBuilder = new StringBuilder();
                    for (int i = 0; i < descEndIndex; i++) {
                        descBuilder.append(tokens[i]).append(" ");
                    }
                    String description = descBuilder.toString().trim();
                    
                    Double debit = 0.0;
                    Double credit = 0.0;
                    Double balance = null;
                    
                    // Based on typical bank statements:
                    // If 3 amounts: Debit, Credit, Balance (or one is empty so they might just have 2 amounts and balance)
                    // If 2 amounts: Amount, Balance OR Debit, Credit
                    // If 1 amount: Amount
                    
                    if (amounts.size() >= 3) {
                        debit = amounts.get(0);
                        credit = amounts.get(1);
                        balance = amounts.get(2);
                    } else if (amounts.size() == 2) {
                        // Guess based on sign or typical format
                        // Assuming Amount, Balance
                        double amt = amounts.get(0);
                        if (amt < 0) {
                            debit = Math.abs(amt);
                        } else {
                            // Can't reliably tell if positive amount is debit or credit without headers
                            // Usually, if there's only 2 numbers, one might be a withdrawal/deposit and the other balance.
                            // We will assume Credit if it's positive.
                            credit = amt;
                        }
                        balance = amounts.get(1);
                    } else if (amounts.size() == 1) {
                        double amt = amounts.get(0);
                        if (amt < 0) {
                            debit = Math.abs(amt);
                        } else {
                            credit = amt;
                        }
                    }
                    
                    // Handle case where debit and credit are in the same column (sign based)
                    if (debit == 0.0 && credit == 0.0) continue;
                    
                    transactions.add(ParsedTransactionDto.builder()
                            .date(date)
                            .description(description)
                            .debitAmount(debit)
                            .creditAmount(credit)
                            .balance(balance)
                            .build());
                }
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
        // Looks like a number: optional sign, digits, optional commas, dot, 2 digits
        // e.g. -1,234.56 or 100.00
        if (amountStr == null || amountStr.isEmpty()) return null;
        
        // Basic check if it has digits
        if (!amountStr.matches(".*\\d.*")) return null;
        
        // Remove commas
        String clean = amountStr.replace(",", "");
        
        // Check if it's a valid decimal number or integer
        if (clean.matches("^-?\\d+(\\.\\d{1,2})?$") || clean.matches("^-?\\.\\d{1,2}$")) {
            try {
                return Double.parseDouble(clean);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
