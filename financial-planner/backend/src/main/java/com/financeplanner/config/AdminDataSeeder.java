package com.financeplanner.config;

import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        String adminEmail = "admin@financeplanner.com";

        java.util.Optional<User> existingAdmin = userRepository.findByEmail(adminEmail);

        if (existingAdmin.isEmpty()) {
            User admin = User.builder()
                    .name("Admin")
                    .email(adminEmail)
                    .password(passwordEncoder.encode("Admin@123"))
                    .role(Role.ROLE_ADMIN)
                    .status(AccountStatus.ACTIVE)
                    .build();
            userRepository.save(admin);
            log.info("✅ Default admin account created: {}", adminEmail);
        } else {
            User admin = existingAdmin.get();
            admin.setPassword(passwordEncoder.encode("Admin@123"));
            admin.setRole(Role.ROLE_ADMIN);
            admin.setStatus(AccountStatus.ACTIVE);
            userRepository.save(admin);
            log.info("ℹ️ Admin account already exists. Password, role, and status reset: {}", adminEmail);
        }
    }
}
