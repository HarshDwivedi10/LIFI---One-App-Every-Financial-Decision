package com.financeplanner.service;

import com.financeplanner.dto.RegisterRequest;
import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository repository;
    private final CoachProfileRepository coachProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public Map<String, Object> register(RegisterRequest request) {
        String email = request.getEmail();
        Optional<User> existingUser = repository.findByEmail(email);
        if (existingUser.isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        boolean isCoach = "COACH".equalsIgnoreCase(request.getRole());

        var user = User.builder()
                .name(request.getName())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(isCoach ? Role.ROLE_COACH : Role.ROLE_USER)
                .status(isCoach ? AccountStatus.PENDING : AccountStatus.ACTIVE)
                .build();
        repository.save(user);

        if (isCoach) {
            CoachProfile coachProfile = CoachProfile.builder()
                    .user(user)
                    .resumeBase64(request.getResumeBase64())
                    .build();
            coachProfileRepository.save(coachProfile);
            return Map.of("message", "Registration successful, pending admin approval");
        }

        var jwtToken = jwtService.generateToken(user);
        return Map.of("token", jwtToken, "user", getUserDataMap(user));
    }

    public Map<String, Object> login(Map<String, String> request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.get("email"),
                        request.get("password")
                )
        );
        var user = repository.findByEmail(request.get("email"))
                .orElseThrow();
        
        if (user.getStatus() == AccountStatus.PENDING) {
            throw new RuntimeException("Account is pending approval");
        }
        if (user.getStatus() == AccountStatus.SUSPENDED) {
            throw new RuntimeException("Account has been suspended");
        }
        if (user.getStatus() == AccountStatus.REJECTED) {
            throw new RuntimeException("Account application was rejected");
        }

        var jwtToken = jwtService.generateToken(user);
        return Map.of("token", jwtToken, "user", getUserDataMap(user));
    }

    private Map<String, Object> getUserDataMap(User user) {
        Map<String, Object> userData = new java.util.HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole() != null ? user.getRole().name() : Role.ROLE_USER.name());
        userData.put("status", user.getStatus() != null ? user.getStatus().name() : AccountStatus.ACTIVE.name());
        if (user.getAssignedCoach() != null) {
            userData.put("assignedCoachName", user.getAssignedCoach().getName());
            userData.put("assignedCoachId", user.getAssignedCoach().getId());
        }
        return userData;
    }
}
