package com.financeplanner.config;

import com.financeplanner.entity.*;
import com.financeplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DemoDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final IncomeSourceRepository incomeSourceRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final TransactionRepository transactionRepository;
    private final GoalRepository goalRepository;
    private final AssetRepository assetRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        String demoEmail = "john.sharma@gmail.com";

        Optional<User> existingUser = userRepository.findByEmail(demoEmail);
        if (existingUser.isPresent()) {
            log.info("Demo user {} already exists. Skipping demo data seeding.", demoEmail);
            return; // Skip if already seeded to avoid duplicates
        }

        log.info("Seeding demo data for John Sharma...");

        // 1. Create User
        User john = User.builder()
                .name("John Sharma")
                .email(demoEmail)
                .password(passwordEncoder.encode("JOHN123"))
                .role(Role.ROLE_USER)
                .status(AccountStatus.ACTIVE)
                .salaryDay(5)
                .manualTotalSavings(100000.0) // Pre-existing savings
                .preExistingSavingsDate(LocalDate.now().minusMonths(4).toString())
                .fundAllocationsJson("{\"core\":{\"LONG_TERM\":20,\"SHORT_TERM\":20,\"EMERGENCY\":20,\"WEALTH\":20},\"retirement\":20}")
                .build();
        john = userRepository.save(john);

        // 2. Create Income Sources
        IncomeSource salary = IncomeSource.builder()
                .user(john)
                .description("TechCorp Salary")
                .amount(80000.0)
                .type(IncomeSource.IncomeType.SALARY)
                .dayOfMonth(5)
                .build();
        incomeSourceRepository.save(salary);

        IncomeSource freelance = IncomeSource.builder()
                .user(john)
                .description("Freelance UI Work")
                .amount(20000.0)
                .type(IncomeSource.IncomeType.FREELANCE)
                .dayOfMonth(20)
                .build();
        incomeSourceRepository.save(freelance);

        // 3. Create Fixed Expenses
        FixedExpense rent = FixedExpense.builder()
                .user(john)
                .description("Apartment Rent")
                .amount(25000.0)
                .category("Housing")
                .dayOfMonth(1)
                .build();
        rent = fixedExpenseRepository.save(rent);

        FixedExpense carLoan = FixedExpense.builder()
                .user(john)
                .description("Car Loan EMI")
                .amount(12000.0)
                .category("Debt")
                .dayOfMonth(10)
                .build();
        carLoan = fixedExpenseRepository.save(carLoan);

        // 4. Generate 3 Months of Historical Transactions
        LocalDate today = LocalDate.now();
        for (int i = 3; i >= 1; i--) {
            LocalDate monthDate = today.minusMonths(i);
            int year = monthDate.getYear();
            int month = monthDate.getMonthValue();

            // Income Txns
            saveTxn(john, "TechCorp Salary", 80000.0, "CREDIT", "Salary", LocalDate.of(year, month, 5));
            saveTxn(john, "Freelance UI Work", 20000.0, "CREDIT", "Freelance", LocalDate.of(year, month, 20));

            // Fixed Expense Txns
            saveTxn(john, "Apartment Rent", 25000.0, "DEBIT", "Housing", LocalDate.of(year, month, 1), rent.getId());
            saveTxn(john, "Car Loan EMI", 12000.0, "DEBIT", "Debt", LocalDate.of(year, month, 10), carLoan.getId());

            // Variable Expenses
            saveTxn(john, "Groceries Supermart", 8500.0, "DEBIT", "Groceries", LocalDate.of(year, month, 12));
            saveTxn(john, "Electricity Bill", 2500.0, "DEBIT", "Utilities", LocalDate.of(year, month, 15));
            saveTxn(john, "Weekend Dining", 4000.0, "DEBIT", "Dining", LocalDate.of(year, month, 22));
            saveTxn(john, "Netflix & Spotify", 1000.0, "DEBIT", "Entertainment", LocalDate.of(year, month, 28));
        }

        // Current Month Data (up to today's day)
        int currentDay = today.getDayOfMonth();
        if (currentDay >= 1) saveTxn(john, "Apartment Rent", 25000.0, "DEBIT", "Housing", today.withDayOfMonth(1), rent.getId());
        if (currentDay >= 5) saveTxn(john, "TechCorp Salary", 80000.0, "CREDIT", "Salary", today.withDayOfMonth(5));
        if (currentDay >= 10) saveTxn(john, "Car Loan EMI", 12000.0, "DEBIT", "Debt", today.withDayOfMonth(10), carLoan.getId());
        if (currentDay >= 12) saveTxn(john, "Groceries Supermart", 3500.0, "DEBIT", "Groceries", today.withDayOfMonth(12));

        // 5. Create Goals
        Goal maldives = Goal.builder()
                .user(john)
                .name("Maldives Vacation")
                .cost(150000.0)
                .targetDate(today.plusMonths(6))
                .category("Travel")
                .priority(Goal.Priority.HIGH)
                .build();
        goalRepository.save(maldives);

        Goal macbook = Goal.builder()
                .user(john)
                .name("New Macbook Pro")
                .cost(200000.0)
                .targetDate(today.plusMonths(2))
                .category("Electronics")
                .priority(Goal.Priority.MEDIUM)
                .build();
        goalRepository.save(macbook);

        // 6. Create Funds (Assets)
        // 3 months of savings roughly: Income (100k) - Fixed (37k) - Variable (16k) = 47k savings/month
        // Total historical savings ~ 141k. Plus pre-existing 100k = 241k.
        // Let's divide 200k evenly among funds, leaving some discrepancy.
        saveAsset(john, "RETIREMENT", "Retirement Corpus", 40000.0);
        saveAsset(john, "LONG_TERM", "Long-Term Goal Corpus", 40000.0);
        saveAsset(john, "SHORT_TERM", "Short-Term Goal Corpus", 40000.0);
        saveAsset(john, "EMERGENCY", "Emergency & Protection Corpus", 40000.0);
        saveAsset(john, "WEALTH", "Wealth Creation Corpus", 40000.0);
        saveAsset(john, "UNALLOCATED", "Unallocated Savings", 0.0);

        log.info("Demo data for John Sharma created successfully!");
    }

    private void saveTxn(User user, String desc, Double amount, String type, String category, LocalDate date) {
        saveTxn(user, desc, amount, type, category, date, null);
    }

    private void saveTxn(User user, String desc, Double amount, String type, String category, LocalDate date, Long fixedExpenseId) {
        Transaction t = Transaction.builder()
                .user(user)
                .description(desc)
                .amount(amount)
                .type(type)
                .category(category)
                .date(date.toString())
                .fixedExpenseId(fixedExpenseId)
                .build();
        transactionRepository.save(t);
    }

    private void saveAsset(User user, String type, String name, Double value) {
        Asset a = Asset.builder()
                .user(user)
                .assetType(type)
                .name(name)
                .currentValue(value)
                .build();
        assetRepository.save(a);
    }
}
