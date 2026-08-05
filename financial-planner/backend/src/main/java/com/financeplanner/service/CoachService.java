package com.financeplanner.service;

import com.financeplanner.dto.CoachDetailDTO;
import com.financeplanner.dto.CoachSuggestionDTO;
import com.financeplanner.dto.PendingEditDTO;
import com.financeplanner.dto.UserManagementDTO;
import com.financeplanner.entity.*;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.CoachSuggestionRepository;
import com.financeplanner.repository.PendingEditRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoachService {

    private final UserRepository userRepository;
    private final CoachProfileRepository coachProfileRepository;
    private final CoachSuggestionRepository coachSuggestionRepository;
    private final PendingEditRepository pendingEditRepository;
    private final UserManagementService userManagementService;
    private final CoachManagementService coachManagementService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    @Transactional(readOnly = true)
    public List<UserManagementDTO> getAssignedUsers(Long coachId) {
        User coachRef = userRepository.getReferenceById(coachId);
        List<User> users = userRepository.findByAssignedCoach(coachRef);
        return users.stream().map(u -> {
            UserManagementDTO dto = userManagementService.toDTO(u);
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CoachDetailDTO getProfile(Long coachId) {
        CoachProfile cp = coachProfileRepository.findByUserIdWithUser(coachId)
                .orElseGet(() -> {
                    User coachUser = userRepository.findById(coachId)
                            .orElseThrow(() -> new RuntimeException("Coach user not found"));
                    CoachProfile newProfile = CoachProfile.builder().user(coachUser).build();
                    return coachProfileRepository.save(newProfile);
                });
        return coachManagementService.getCoachByUserId(coachId);
    }

    @Transactional
    public CoachDetailDTO updateProfile(Long coachId, CoachDetailDTO request) {
        CoachProfile cp = coachProfileRepository.findByUserIdWithUser(coachId)
                .orElseGet(() -> {
                    User coachUser = userRepository.findById(coachId)
                            .orElseThrow(() -> new RuntimeException("Coach user not found"));
                    return coachProfileRepository.save(CoachProfile.builder().user(coachUser).build());
                });

        if (request.getTitle() != null) cp.setTitle(request.getTitle());
        if (request.getLocation() != null) cp.setLocation(request.getLocation());
        if (request.getYearsExperience() != null) cp.setYearsExperience(request.getYearsExperience());
        if (request.getRating() != null) cp.setRating(request.getRating());
        if (request.getClientCount() != null) cp.setClientCount(request.getClientCount());
        if (request.getAboutMe() != null) cp.setAboutMe(request.getAboutMe());
        if (request.getExpertise() != null) cp.setExpertise(request.getExpertise());
        if (request.getProfilePictureBase64() != null) cp.setProfilePictureBase64(request.getProfilePictureBase64());
        if (request.getConsultationFee() != null) cp.setConsultationFee(request.getConsultationFee());
        if (request.getPhone() != null) cp.setPhone(request.getPhone());
        if (request.getLinkedIn() != null) cp.setLinkedIn(request.getLinkedIn());
        if (request.getProfessionalSummary() != null) cp.setProfessionalSummary(request.getProfessionalSummary());
        if (request.getExperienceDetails() != null) cp.setExperienceDetails(request.getExperienceDetails());
        if (request.getEducationDetails() != null) cp.setEducationDetails(request.getEducationDetails());
        if (request.getResumeBase64() != null) cp.setResumeBase64(request.getResumeBase64());

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            User user = cp.getUser();
            user.setName(request.getName().trim());
            userRepository.save(user);
        }

        coachProfileRepository.save(cp);
        return coachManagementService.getCoachByUserId(coachId);
    }

    @Transactional(readOnly = true)
    public List<CoachDetailDTO> getActiveCoachesForUser(Long currentUserId) {
        List<CoachProfile> activeProfiles = coachProfileRepository.findAllByUserStatusWithUser(AccountStatus.ACTIVE);
        User currentUser = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
        Long currentCoachId = (currentUser != null && currentUser.getAssignedCoach() != null) ? currentUser.getAssignedCoach().getId() : null;

        return activeProfiles.stream().map(cp -> {
            CoachDetailDTO dto = coachManagementService.getCoachByUserId(cp.getUser().getId());
            if (currentCoachId != null && cp.getUser().getId().equals(currentCoachId)) {
                dto.setHiredByCurrentUser(true);
            }
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void hireCoach(Long userId, Long coachId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        User coach = userRepository.findById(coachId)
                .orElseThrow(() -> new RuntimeException("Coach not found"));
        if (coach.getStatus() != AccountStatus.ACTIVE) {
            throw new RuntimeException("Selected coach is not active");
        }
        user.setAssignedCoach(coach);
        userRepository.save(user);
    }

    // ──────────────────── PERMISSIONS / SUGGESTIONS / PENDING EDITS ────────────────────

    @Transactional(readOnly = true)
    public String getCoachPermission(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getCoachPermission() != null ? user.getCoachPermission() : "READ_ONLY";
    }

    @Transactional
    public String updateCoachPermission(Long userId, String permission) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        String perm = ("READ_WRITE".equalsIgnoreCase(permission) || "READ_EDIT".equalsIgnoreCase(permission)) ? "READ_WRITE" : "READ_ONLY";
        user.setCoachPermission(perm);
        userRepository.save(user);
        return perm;
    }

    @Transactional(readOnly = true)
    public List<CoachSuggestionDTO> getCoachSuggestions(Long userId) {
        return coachSuggestionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(cs -> CoachSuggestionDTO.builder()
                        .id(cs.getId())
                        .coachName(cs.getCoach() != null ? cs.getCoach().getName() : "Financial Expert")
                        .category(cs.getCategory() != null ? cs.getCategory() : "General Advice")
                        .suggestionText(cs.getSuggestionText())
                        .createdAt(cs.getCreatedAt() != null ? cs.getCreatedAt().format(DATE_FMT) : "-")
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public CoachSuggestionDTO postCoachSuggestion(Long coachId, Long targetUserId, String suggestionText, String category) {
        User coach = userRepository.findById(coachId).orElseThrow(() -> new RuntimeException("Coach not found"));
        User targetUser = userRepository.findById(targetUserId).orElseThrow(() -> new RuntimeException("Target user not found"));

        CoachSuggestion cs = CoachSuggestion.builder()
                .user(targetUser)
                .coach(coach)
                .suggestionText(suggestionText)
                .category(category != null && !category.trim().isEmpty() ? category.trim() : "General Advice")
                .build();

        coachSuggestionRepository.save(cs);

        return CoachSuggestionDTO.builder()
                .id(cs.getId())
                .coachName(coach.getName())
                .category(cs.getCategory())
                .suggestionText(cs.getSuggestionText())
                .createdAt(cs.getCreatedAt().format(DATE_FMT))
                .build();
    }

    @Transactional(readOnly = true)
    public List<PendingEditDTO> getPendingEdits(Long userId) {
        return pendingEditRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, "PENDING")
                .stream()
                .map(pe -> PendingEditDTO.builder()
                        .id(pe.getId())
                        .coachName(pe.getCoach() != null ? pe.getCoach().getName() : "Coach")
                        .entityType(pe.getEntityType())
                        .description(pe.getDescription())
                        .payloadJson(pe.getPayloadJson())
                        .status(pe.getStatus())
                        .createdAt(pe.getCreatedAt() != null ? pe.getCreatedAt().format(DATE_FMT) : "-")
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public PendingEditDTO proposeEdit(Long coachId, Long targetUserId, String entityType, String description, String payloadJson) {
        User coach = userRepository.findById(coachId).orElseThrow(() -> new RuntimeException("Coach not found"));
        User targetUser = userRepository.findById(targetUserId).orElseThrow(() -> new RuntimeException("Target user not found"));

        PendingEdit pe = PendingEdit.builder()
                .user(targetUser)
                .coach(coach)
                .entityType(entityType != null ? entityType : "PORTFOLIO")
                .description(description != null ? description : "Coach proposed portfolio update")
                .payloadJson(payloadJson)
                .status("PENDING")
                .build();

        pendingEditRepository.save(pe);

        return PendingEditDTO.builder()
                .id(pe.getId())
                .coachName(coach.getName())
                .entityType(pe.getEntityType())
                .description(pe.getDescription())
                .payloadJson(pe.getPayloadJson())
                .status(pe.getStatus())
                .createdAt(pe.getCreatedAt().format(DATE_FMT))
                .build();
    }

    @Transactional
    public void acceptPendingEdit(Long userId, Long editId) {
        PendingEdit pe = pendingEditRepository.findById(editId)
                .orElseThrow(() -> new RuntimeException("Pending edit request not found"));
        if (!pe.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized edit request");
        }
        pe.setStatus("ACCEPTED");
        pendingEditRepository.save(pe);
    }

    @Transactional
    public void rejectPendingEdit(Long userId, Long editId) {
        PendingEdit pe = pendingEditRepository.findById(editId)
                .orElseThrow(() -> new RuntimeException("Pending edit request not found"));
        if (!pe.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized edit request");
        }
        pe.setStatus("REJECTED");
        pendingEditRepository.save(pe);
    }
}
