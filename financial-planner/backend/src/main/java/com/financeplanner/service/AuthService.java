package com.financeplanner.service;

import com.financeplanner.entity.User;
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
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public Map<String, Object> register(Map<String, String> request) {
        String email = request.get("email");
        Optional<User> existingUser = repository.findByEmail(email);
        if (existingUser.isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        var user = User.builder()
                .name(request.get("name"))
                .email(email)
                .password(passwordEncoder.encode(request.get("password")))
                .build();
        repository.save(user);

        var jwtToken = jwtService.generateToken(user);
        return Map.of("token", jwtToken, "user", user);
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
        var jwtToken = jwtService.generateToken(user);
        return Map.of("token", jwtToken, "user", user);
    }
}
