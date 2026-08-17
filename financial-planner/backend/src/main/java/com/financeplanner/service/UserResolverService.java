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

        if (authenticatedUser.getRole() == Role.ROLE_ADMIN) {
            // Admins can view any user
            String targetHeader = request.getHeader("X-Target-User-Id");
            if (targetHeader != null && !targetHeader.trim().isEmpty()) {
                try {
                    Long targetUserId = Long.parseLong(targetHeader.trim());
                    return userRepository.findById(targetUserId).orElse(authenticatedUser);
                } catch (NumberFormatException ignored) {}
            }
        } else if (authenticatedUser.getRole() == Role.ROLE_COACH) {
            // Coaches can only view users who have specifically hired them
            String targetHeader = request.getHeader("X-Target-User-Id");
            if (targetHeader != null && !targetHeader.trim().isEmpty()) {
                try {
                    Long targetUserId = Long.parseLong(targetHeader.trim());
                    User targetUser = userRepository.findById(targetUserId).orElse(null);
                    if (targetUser != null
                            && targetUser.getAssignedCoach() != null
                            && targetUser.getAssignedCoach().getId().equals(authenticatedUser.getId())) {
                        return targetUser;
                    }
                    // Coach is NOT assigned to this user — deny impersonation, return self
                    return authenticatedUser;
                } catch (NumberFormatException ignored) {}
            }
        }
        return authenticatedUser;
    }
}
