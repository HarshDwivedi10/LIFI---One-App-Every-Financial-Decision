package com.financeplanner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FinancePlannerApplication {
    public static void main(String[] args) {
        SpringApplication.run(FinancePlannerApplication.class, args);
    }
}
