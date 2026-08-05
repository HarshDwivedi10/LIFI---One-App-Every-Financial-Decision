package com.financeplanner.service;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.User;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoachManagementService {

    private final CoachProfileRepository coachProfileRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    // ──────────────────── LIST / FILTER / SEARCH ────────────────────

    @Transactional
    public List<CoachDetailDTO> getAllCoaches() {
        List<User> coachUsers = userRepository.findAllByRole(Role.ROLE_COACH);
        List<CoachDetailDTO> dtos = new ArrayList<>();
        for (User u : coachUsers) {
            CoachProfile cp = coachProfileRepository.findByUser(u)
                    .orElseGet(() -> coachProfileRepository.save(CoachProfile.builder().user(u).build()));
            dtos.add(toDetailDTO(cp));
        }
        return dtos;
    }

    @Transactional
    public CoachDetailDTO getCoachByUserId(Long userId) {
        User u = findCoachUser(userId);
        CoachProfile cp = coachProfileRepository.findByUser(u)
                .orElseGet(() -> coachProfileRepository.save(CoachProfile.builder().user(u).build()));
        return toDetailDTO(cp);
    }

    @Transactional
    public List<CoachDetailDTO> filterByStatus(String status) {
        if ("ALL".equalsIgnoreCase(status)) {
            return getAllCoaches();
        }
        AccountStatus accountStatus;
        try {
            accountStatus = AccountStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid status: " + status);
        }
        List<User> coachUsers = userRepository.findAllByRoleAndStatus(Role.ROLE_COACH, accountStatus);
        List<CoachDetailDTO> dtos = new ArrayList<>();
        for (User u : coachUsers) {
            CoachProfile cp = coachProfileRepository.findByUser(u)
                    .orElseGet(() -> coachProfileRepository.save(CoachProfile.builder().user(u).build()));
            dtos.add(toDetailDTO(cp));
        }
        return dtos;
    }

    @Transactional
    public List<CoachDetailDTO> searchCoaches(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllCoaches();
        }
        String kw = keyword.trim().toLowerCase();
        return getAllCoaches().stream()
                .filter(c -> (c.getName() != null && c.getName().toLowerCase().contains(kw)) ||
                             (c.getEmail() != null && c.getEmail().toLowerCase().contains(kw)) ||
                             (c.getTitle() != null && c.getTitle().toLowerCase().contains(kw)) ||
                             (c.getExpertise() != null && c.getExpertise().toLowerCase().contains(kw)))
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

    public CoachDetailDTO toDetailDTO(CoachProfile cp) {
        User u = cp.getUser();
        String name = (u != null && u.getName() != null) ? u.getName() : "Coach";
        String email = (u != null && u.getEmail() != null) ? u.getEmail() : "";
        String statusStr = (u != null && u.getStatus() != null) ? u.getStatus().name() : "PENDING";
        String createdAtStr = (u != null && u.getCreatedAt() != null) ? u.getCreatedAt().format(DATE_FMT) : "-";
        Long userId = (u != null) ? u.getId() : null;

        String safeSlug = name.toLowerCase().replaceAll("[^a-z0-9]", "");

        return CoachDetailDTO.builder()
                .userId(userId)
                .name(name)
                .email(email)
                .status(statusStr)
                .createdAt(createdAtStr)
                .profileId(cp.getId())
                .resumeBase64(cp.getResumeBase64())
                .title(cp.getTitle() != null ? cp.getTitle() : "Financial Planning Coach")
                .location(cp.getLocation() != null ? cp.getLocation() : "Mumbai, India")
                .yearsExperience(cp.getYearsExperience() != null ? cp.getYearsExperience() : "10+ Years")
                .rating(cp.getRating() != null ? cp.getRating() : 4.9)
                .clientCount(cp.getClientCount() != null ? cp.getClientCount() : "120+ Clients")
                .aboutMe(cp.getAboutMe() != null ? cp.getAboutMe() : "Certified financial planner with expertise in wealth management, retirement planning, tax optimization, and goal-based financial planning.")
                .expertise(cp.getExpertise() != null ? cp.getExpertise() : "Retirement Planning, Investment Strategy, Tax Planning, Goal Based Financial Planning, Wealth Management")
                .profilePictureBase64(cp.getProfilePictureBase64())
                .consultationFee(cp.getConsultationFee() != null ? cp.getConsultationFee() : 1999.0)
                .phone(cp.getPhone() != null ? cp.getPhone() : "+91 98765 43210")
                .linkedIn(cp.getLinkedIn() != null ? cp.getLinkedIn() : ("linkedin.com/in/" + safeSlug))
                .professionalSummary(cp.getProfessionalSummary() != null ? cp.getProfessionalSummary() : "Financial planning professional dedicated to helping individuals achieve their long-term financial goals through strategic planning and wealth management.")
                .experienceDetails(cp.getExperienceDetails() != null ? cp.getExperienceDetails() : "Senior Financial Planner | Financial Services | 2018 - Present\nProvide comprehensive financial planning services including investment planning, retirement planning, and tax planning.")
                .educationDetails(cp.getEducationDetails() != null ? cp.getEducationDetails() : "Certified Financial Planner (CFP) | CFP Board | 2015")
                .build();
    }
}
