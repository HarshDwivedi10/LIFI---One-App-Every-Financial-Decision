package com.financeplanner.service;

import com.financeplanner.dto.AdminDashboardDTO;
import com.financeplanner.dto.AdminDashboardDTO.*;
import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.repository.AssetRepository;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.TransactionRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final CoachProfileRepository coachProfileRepository;

    public AdminDashboardDTO getDashboard() {
        return AdminDashboardDTO.builder()
                .stats(buildStats())
                .charts(buildCharts())
                .tables(buildTables())
                .build();
    }

    // ──────────────────── STATS ────────────────────

    private StatsDTO buildStats() {
        long totalUsers  = userRepository.countByRole(Role.ROLE_USER);
        long totalCoaches = userRepository.countByRole(Role.ROLE_COACH);
        long pendingCoaches = userRepository.countByRoleAndStatus(Role.ROLE_COACH, AccountStatus.PENDING);
        long activeCoaches  = userRepository.countByRoleAndStatus(Role.ROLE_COACH, AccountStatus.ACTIVE);
        long totalTransactions = transactionRepository.countAllTransactions();
        double totalAssets = Optional.ofNullable(assetRepository.sumAllAssetValues()).orElse(0.0);

        return StatsDTO.builder()
                .totalUsers(totalUsers)
                .totalCoaches(totalCoaches)
                .pendingCoachRequests(pendingCoaches)
                .activeCoaches(activeCoaches)
                .totalTransactions(totalTransactions)
                .totalAssets(totalAssets)
                .build();
    }

    // ──────────────────── CHARTS ────────────────────

    private ChartsDTO buildCharts() {
        return ChartsDTO.builder()
                .monthlyUserRegistrations(buildMonthlyRegistrations())
                .userCoachRatio(buildUserCoachRatio())
                .activeVsPendingCoaches(buildActiveVsPending())
                .build();
    }

    private List<MonthlyRegistrationDTO> buildMonthlyRegistrations() {
        List<User> allUsers = userRepository.findAll();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM yyyy");

        // Group users by their registration month
        Map<String, Long> monthlyMap = new LinkedHashMap<>();
        allUsers.stream()
                .filter(u -> u.getCreatedAt() != null)
                .sorted(Comparator.comparing(User::getCreatedAt))
                .forEach(u -> {
                    String month = u.getCreatedAt().format(formatter);
                    monthlyMap.merge(month, 1L, Long::sum);
                });

        return monthlyMap.entrySet().stream()
                .map(e -> MonthlyRegistrationDTO.builder().month(e.getKey()).count(e.getValue()).build())
                .collect(Collectors.toList());
    }

    private List<RatioDTO> buildUserCoachRatio() {
        long users  = userRepository.countByRole(Role.ROLE_USER);
        long coaches = userRepository.countByRole(Role.ROLE_COACH);
        return List.of(
                RatioDTO.builder().name("Users").value(users).build(),
                RatioDTO.builder().name("Coaches").value(coaches).build()
        );
    }

    private List<RatioDTO> buildActiveVsPending() {
        long active  = userRepository.countByRoleAndStatus(Role.ROLE_COACH, AccountStatus.ACTIVE);
        long pending = userRepository.countByRoleAndStatus(Role.ROLE_COACH, AccountStatus.PENDING);
        return List.of(
                RatioDTO.builder().name("Active").value(active).build(),
                RatioDTO.builder().name("Pending").value(pending).build()
        );
    }

    // ──────────────────── TABLES ────────────────────

    private TablesDTO buildTables() {
        return TablesDTO.builder()
                .recentUsers(buildRecentUsers())
                .pendingCoaches(buildPendingCoaches())
                .recentCoaches(buildRecentCoaches())
                .build();
    }

    private List<UserSummaryDTO> buildRecentUsers() {
        return userRepository.findTop5ByRoleOrderByCreatedAtDesc(Role.ROLE_USER)
                .stream()
                .map(this::toUserSummary)
                .collect(Collectors.toList());
    }

    private List<CoachSummaryDTO> buildPendingCoaches() {
        List<CoachProfile> all = coachProfileRepository.findAllWithUserOrderByCreatedAtDesc();
        return all.stream()
                .filter(cp -> cp.getUser().getStatus() == AccountStatus.PENDING)
                .limit(5)
                .map(this::toCoachSummary)
                .collect(Collectors.toList());
    }

    private List<CoachSummaryDTO> buildRecentCoaches() {
        List<CoachProfile> all = coachProfileRepository.findAllWithUserOrderByCreatedAtDesc();
        return all.stream()
                .limit(5)
                .map(this::toCoachSummary)
                .collect(Collectors.toList());
    }

    // ──────────────────── MAPPERS ────────────────────

    private UserSummaryDTO toUserSummary(User u) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy");
        return UserSummaryDTO.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole() != null ? u.getRole().name() : "ROLE_USER")
                .status(u.getStatus() != null ? u.getStatus().name() : "ACTIVE")
                .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().format(fmt) : "-")
                .build();
    }

    private CoachSummaryDTO toCoachSummary(CoachProfile cp) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy");
        User u = cp.getUser();
        return CoachSummaryDTO.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .status(u.getStatus() != null ? u.getStatus().name() : "PENDING")
                .areaOfExpertise(cp.getAreaOfExpertise())
                .qualification(cp.getQualification())
                .yearsOfExperience(cp.getYearsOfExperience())
                .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().format(fmt) : "-")
                .build();
    }
}
