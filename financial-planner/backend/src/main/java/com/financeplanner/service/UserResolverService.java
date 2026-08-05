package com.financeplanner.service;

import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserResolverService {

    private final UserRepository userRepository;

    public User getEffectiveUser(User authenticatedUser, HttpServletRequest request) {
        if (authenticatedUser == null) return null;

        if (authenticatedUser.getRole() == Role.ROLE_COACH || authenticatedUser.getRole() == Role.ROLE_ADMIN) {
            String targetHeader = request.getHeader("X-Target-User-Id");
            if (targetHeader != null && !targetHeader.trim().isEmpty()) {
                try {
                    Long targetUserId = Long.parseLong(targetHeader.trim());
                    return userRepository.findById(targetUserId).orElse(authenticatedUser);
                } catch (NumberFormatException ignored) {}
            }
        }
        return authenticatedUser;
    }
}
