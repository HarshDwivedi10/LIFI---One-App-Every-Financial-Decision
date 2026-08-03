package com.financeplanner.service.parser;

import com.financeplanner.dto.ParsedTransactionDto;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface BankStatementParser {
    
    /**
     * Parse a bank statement file and return a list of parsed transactions.
     * 
     * @param file the uploaded file
     * @return list of parsed transactions
     * @throws Exception if parsing fails
     */
    List<ParsedTransactionDto> parse(MultipartFile file) throws Exception;
    
    /**
     * Check if this parser supports the given file based on its extension or content type.
     * 
     * @param file the uploaded file
     * @return true if supported, false otherwise
     */
    boolean supports(MultipartFile file);
}
