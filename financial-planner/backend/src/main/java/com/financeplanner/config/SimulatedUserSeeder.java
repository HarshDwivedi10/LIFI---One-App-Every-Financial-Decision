package com.financeplanner.config;

import com.financeplanner.entity.*;
import com.financeplanner.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Configuration
public class SimulatedUserSeeder {

    @Bean
    public CommandLineRunner runSimulatedUserSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            IncomeSourceRepository incomeRepo,
            TransactionRepository txnRepo,
            FixedExpenseRepository fixedExpenseRepo,
            GoalRepository goalRepo,
            AssetRepository assetRepo) {

        return args -> {
            String email = "demo@financeplanner.com";
            String plainPassword = "Demo@123";
            Optional<User> existingUser = userRepository.findByEmail(email);

            // ── If user already exists: reset password so credentials always work ──
            if (existingUser.isPresent()) {
                User u = existingUser.get();
                u.setPassword(passwordEncoder.encode(plainPassword));
                u.setStatus(AccountStatus.ACTIVE);
                userRepository.save(u);
                System.out.println("[SEEDER] Demo user exists. Password reset to: Demo@123");
                return;
            }

            // ── Fresh creation ────────────────────────────────────────────────────
            System.out.println("[SEEDER] Creating demo user from scratch...");

            User user = User.builder()
                    .name("Demo User")
                    .email(email)
                    .password(passwordEncoder.encode(plainPassword))
                    .role(Role.ROLE_USER)
                    .status(AccountStatus.ACTIVE)
                    .createdAt(LocalDateTime.now().minusMonths(5))
                    .build();
            user = userRepository.save(user);

            // Income Source
            incomeRepo.save(IncomeSource.builder()
                    .user(user)
                    .type(IncomeSource.IncomeType.SALARY)
                    .description("TechCorp Monthly Salary")
                    .amount(80000.0)
                    .dayOfMonth(1)
                    .build());

            // Fixed Expenses
            fixedExpenseRepo.save(FixedExpense.builder()
                    .user(user)
                    .category("Housing")
                    .description("Apartment Rent")
                    .amount(20000.0)
                    .dayOfMonth(5)
                    .build());

            fixedExpenseRepo.save(FixedExpense.builder()
                    .user(user)
                    .category("Utilities")
                    .description("Electricity & Water")
                    .amount(3000.0)
                    .dayOfMonth(10)
                    .build());

            // 5 Months of Transactions
            LocalDate now = LocalDate.now();
            double totalSavings = 0;

            for (int i = 5; i >= 1; i--) {
                LocalDate month = now.minusMonths(i);
                int y = month.getYear();
                int m = month.getMonthValue();

                txnRepo.save(Transaction.builder().user(user)
                        .type(Transaction.TransactionType.INCOME).amount(80000.0)
                        .description("TechCorp Salary").category("Salary")
                        .date(LocalDate.of(y, m, 1)).build());
                totalSavings += 80000.0;

                txnRepo.save(Transaction.builder().user(user)
                        .type(Transaction.TransactionType.EXPENSE).amount(20000.0)
                        .description("Apartment Rent").category("Housing")
                        .date(LocalDate.of(y, m, 5)).build());
                totalSavings -= 20000.0;

                txnRepo.save(Transaction.builder().user(user)
                        .type(Transaction.TransactionType.EXPENSE).amount(3000.0)
                        .description("Electricity & Water").category("Utilities")
                        .date(LocalDate.of(y, m, 10)).build());
                totalSavings -= 3000.0;

                txnRepo.save(Transaction.builder().user(user)
                        .type(Transaction.TransactionType.EXPENSE).amount(12000.0)
                        .description("Groceries & Dining").category("Food")
                        .date(LocalDate.of(y, m, 15)).build());
                totalSavings -= 12000.0;

                txnRepo.save(Transaction.builder().user(user)
                        .type(Transaction.TransactionType.EXPENSE).amount(5000.0)
                        .description("Commute & Travel").category("Transport")
                        .date(LocalDate.of(y, m, 20)).build());
                totalSavings -= 5000.0;
            }

            // Goals
            Goal earphones = goalRepo.save(Goal.builder().user(user)
                    .name("Sony Earphones").cost(15000.0).category("Electronics")
                    .targetDate(now.minusDays(10)).monthlyAllocation(0.0).build());
            assetRepo.save(Asset.builder().user(user).assetType("GOAL")
                    .name(earphones.getId().toString()).currentValue(15000.0).build());
            totalSavings -= 15000.0;

            Goal laptop = goalRepo.save(Goal.builder().user(user)
                    .name("MacBook Pro").cost(100000.0).category("Electronics")
                    .targetDate(now.plusMonths(1)).monthlyAllocation(20.0).build());
            assetRepo.save(Asset.builder().user(user).assetType("GOAL")
                    .name(laptop.getId().toString()).currentValue(80000.0).build());
            totalSavings -= 80000.0;

            Goal tv = goalRepo.save(Goal.builder().user(user)
                    .name("4K Smart TV").cost(50000.0).category("Electronics")
                    .targetDate(now.plusMonths(6)).monthlyAllocation(10.0).build());
            assetRepo.save(Asset.builder().user(user).assetType("GOAL")
                    .name(tv.getId().toString()).currentValue(20000.0).build());
            totalSavings -= 20000.0;

            Goal car = goalRepo.save(Goal.builder().user(user)
                    .name("Hyundai i20").cost(800000.0).category("Vehicle")
                    .targetDate(now.plusYears(2)).monthlyAllocation(30.0).build());
            assetRepo.save(Asset.builder().user(user).assetType("GOAL")
                    .name(car.getId().toString()).currentValue(120000.0).build());
            totalSavings -= 120000.0;

            Goal house = goalRepo.save(Goal.builder().user(user)
                    .name("House Downpayment").cost(2000000.0).category("Real Estate")
                    .targetDate(now.plusYears(5)).monthlyAllocation(40.0).build());
            assetRepo.save(Asset.builder().user(user).assetType("GOAL")
                    .name(house.getId().toString()).currentValue(100000.0).build());
            totalSavings -= 100000.0;

            // Unallocated savings
            double remaining = Math.max(totalSavings, 50000.0);
            assetRepo.save(Asset.builder().user(user).assetType("BANK")
                    .name("HDFC Savings Account").currentValue(remaining).build());

            System.out.println("[SEEDER] Done! Credentials: demo@financeplanner.com / Demo@123");
        };
    }
}
