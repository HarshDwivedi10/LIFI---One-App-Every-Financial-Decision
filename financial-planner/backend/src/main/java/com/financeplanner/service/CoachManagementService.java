package com.financeplanner.service;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.mapper.CoachProfileMapper;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoachManagementService {

    private final CoachProfileRepository coachProfileRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    // ──────────────────── LIST / FILTER / SEARCH ────────────────────

    public List<CoachDetailDTO> getAllCoaches() {
        return coachProfileRepository.findAllWithUserOrderByCreatedAtDesc()
                .stream()
                .map(this::toDetailDTO)
                .collect(Collectors.toList());
    }

    // Used by the public/user-facing Expert Connect page — only approved, active coaches
    public List<CoachDetailDTO> getActiveCoaches() {
        return coachProfileRepository.findAllByUserStatusWithUser(AccountStatus.ACTIVE)
                .stream()
                .map(this::toDetailDTO)
                .collect(Collectors.toList());
    }

    public CoachDetailDTO getCoachByUserId(Long userId) {
        CoachProfile cp = coachProfileRepository.findByUserIdWithUser(userId)
                .orElseThrow(() -> new RuntimeException("Coach not found"));
        return toDetailDTO(cp);
    }

    public List<CoachDetailDTO> filterByStatus(String status) {
        AccountStatus accountStatus;
        try {
            accountStatus = AccountStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid status: " + status);
        }
        List<CoachProfile> profiles = coachProfileRepository.findAllByUserStatusWithUser(accountStatus);
        List<CoachDetailDTO> dtos = profiles.stream().map(this::toDetailDTO).collect(Collectors.toList());

        List<User> coachUsers = userRepository.findAllByRoleAndStatus(Role.ROLE_COACH, accountStatus);
        for (User u : coachUsers) {
            boolean alreadyInList = dtos.stream().anyMatch(d -> d.getUserId().equals(u.getId()));
            if (!alreadyInList) {
                dtos.add(CoachDetailDTO.builder()
                        .userId(u.getId())
                        .name(u.getName())
                        .email(u.getEmail())
                        .status(u.getStatus() != null ? u.getStatus().name() : "ACTIVE")
                        .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().format(DATE_FMT) : "-")
                        .resumeBase64(null)
                        .build());
            }
        }
        return dtos;
    }

    public List<CoachDetailDTO> searchCoaches(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllCoaches();
        }
        return coachProfileRepository.searchCoaches(keyword.trim())
                .stream()
                .map(this::toDetailDTO)
                .collect(Collectors.toList());
    }

    // ──────────────────── STATUS ACTIONS ────────────────────

    @Transactional
    public CoachDetailDTO approveCoach(Long userId) {
        User user = findCoachUser(userId);
        if (user.getStatus() != AccountStatus.PENDING) {
            throw new RuntimeException("Only PENDING coaches can be approved");
        }
        user.setStatus(AccountStatus.ACTIVE);
        userRepository.save(user);
        return getCoachByUserId(userId);
    }

    @Transactional
    public CoachDetailDTO rejectCoach(Long userId) {
        User user = findCoachUser(userId);
        if (user.getStatus() != AccountStatus.PENDING) {
            throw new RuntimeException("Only PENDING coaches can be rejected");
        }
        user.setStatus(AccountStatus.REJECTED);
        userRepository.save(user);
        return getCoachByUserId(userId);
    }

    @Transactional
    public CoachDetailDTO suspendCoach(Long userId) {
        User user = findCoachUser(userId);
        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new RuntimeException("Only ACTIVE coaches can be suspended");
        }
        user.setStatus(AccountStatus.SUSPENDED);
        userRepository.save(user);
        return getCoachByUserId(userId);
    }

    @Transactional
    public CoachDetailDTO activateCoach(Long userId) {
        User user = findCoachUser(userId);
        if (user.getStatus() != AccountStatus.SUSPENDED) {
            throw new RuntimeException("Only SUSPENDED coaches can be activated");
        }
        user.setStatus(AccountStatus.ACTIVE);
        userRepository.save(user);
        return getCoachByUserId(userId);
    }

    @Transactional
    public void deleteCoach(Long userId) {
        User user = findCoachUser(userId);
        coachProfileRepository.findByUser(user)
                .ifPresent(coachProfileRepository::delete);
        userRepository.delete(user);
    }

    // ──────────────────── HELPERS ────────────────────

    private User findCoachUser(Long userId) {
        return userRepository.findByIdAndRole(userId, Role.ROLE_COACH)
                .orElseThrow(() -> new RuntimeException("Coach not found with id: " + userId));
    }

    private CoachDetailDTO toDetailDTO(CoachProfile cp) {
        return CoachProfileMapper.toDetailDTO(cp);
    }
}