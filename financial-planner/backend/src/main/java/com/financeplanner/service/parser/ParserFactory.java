package com.financeplanner.service.parser;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ParserFactory {

    private final List<BankStatementParser> parsers;

    public BankStatementParser getParser(MultipartFile file) {
        for (BankStatementParser parser : parsers) {
            if (parser.supports(file)) {
                return parser;
            }
        }
        throw new IllegalArgumentException("Unsupported file type: " + file.getOriginalFilename());
    }
}
