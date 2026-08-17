package com.financeplanner.service.parser;

import com.financeplanner.dto.ParsedTransactionDto;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

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
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy")
    );

    // Flexible date pattern matching date anywhere near line start (allowing optional S.No or Ref)
    private static final Pattern DATE_PATTERN = Pattern.compile("(?:^|\\b)(\\d{1,2}[-/\\.]\\d{1,2}[-/\\.]\\d{2,4}|\\d{4}[-/\\.]\\d{1,2}[-/\\.]\\d{1,2}|\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{2,4})\\b");

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
                
                Matcher dateMatcher = DATE_PATTERN.matcher(line);
                if (dateMatcher.find()) {
                    String dateStr = dateMatcher.group(1).trim();
                    LocalDate date = parseDate(dateStr);
                    if (date == null) continue;

                    String remainder = line.substring(dateMatcher.end()).trim();
                    if (remainder.isEmpty()) continue;

                    String[] tokens = remainder.split("\\s+");
                    List<Double> amounts = new ArrayList<>();
                    int descEndIndex = tokens.length;
                    
                    // Extract numeric amounts from the end of the line
                    for (int i = tokens.length - 1; i >= 0; i--) {
                        String token = tokens[i];
                        Double amount = parseAmountToken(token);
                        if (amount != null) {
                            amounts.add(0, amount);
                            descEndIndex = i;
                        } else {
                            break;
                        }
                    }
                    
                    if (amounts.isEmpty()) continue;
                    
                    StringBuilder descBuilder = new StringBuilder();
                    for (int i = 0; i < descEndIndex; i++) {
                        descBuilder.append(tokens[i]).append(" ");
                    }
                    String description = descBuilder.toString().trim();
                    String descLower = description.toLowerCase();
                    
                    Double debit = 0.0;
                    Double credit = 0.0;
                    Double balance = null;
                    
                    if (amounts.size() >= 3) {
                        debit = amounts.get(0);
                        credit = amounts.get(1);
                        balance = amounts.get(2);
                    } else if (amounts.size() == 2) {
                        double amt = amounts.get(0);
                        balance = amounts.get(1);

                        if (amt < 0) {
                            debit = Math.abs(amt);
                        } else {
                            // Smart detection based on description keywords
                            if (isDebitDescription(descLower)) {
                                debit = amt;
                            } else if (isCreditDescription(descLower)) {
                                credit = amt;
                            } else {
                                // Fallback: default to debit for general payments/transfers
                                debit = amt;
                            }
                        }
                    } else if (amounts.size() == 1) {
                        double amt = amounts.get(0);
                        if (amt < 0) {
                            debit = Math.abs(amt);
                        } else {
                            if (isCreditDescription(descLower)) {
                                credit = amt;
                            } else {
                                debit = amt;
                            }
                        }
                    }
                    
                    if (debit == 0.0 && credit == 0.0) continue;
                    
                    transactions.add(ParsedTransactionDto.builder()
                            .date(date)
                            .description(description.isEmpty() ? "Bank Transaction" : description)
                            .debitAmount(debit)
                            .creditAmount(credit)
                            .balance(balance)
                            .build());
                }
            }
        }
        
        return transactions;
    }

    private boolean isDebitDescription(String desc) {
        return desc.contains("dr") || desc.contains("debit") || desc.contains("upi/dr") || 
               desc.contains("transfer to") || desc.contains("paid to") || desc.contains("pos") || 
               desc.contains("atm") || desc.contains("purchase") || desc.contains("withdrawal") || 
               desc.contains("imps/dr") || desc.contains("neft/dr") || desc.contains("charges") || 
               desc.contains("fee") || desc.contains("bill") || desc.contains("zomato") || 
               desc.contains("swiggy") || desc.contains("amazon") || desc.contains("flipkart");
    }

    private boolean isCreditDescription(String desc) {
        return desc.contains("cr") || desc.contains("credit") || desc.contains("upi/cr") || 
               desc.contains("transfer from") || desc.contains("received from") || desc.contains("salary") || 
               desc.contains("refund") || desc.contains("interest") || desc.contains("deposit") || 
               desc.contains("imps/cr") || desc.contains("neft/cr") || desc.contains("cash deposit");
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

    private Double parseAmountToken(String token) {
        if (token == null || token.isEmpty()) return null;
        if (!token.matches(".*\\d.*")) return null;
        String clean = token.replace(",", "");
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
