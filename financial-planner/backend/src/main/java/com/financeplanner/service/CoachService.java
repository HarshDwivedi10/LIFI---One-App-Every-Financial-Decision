package com.financeplanner.service;

import com.financeplanner.dto.UserManagementDTO;
import com.financeplanner.entity.User;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoachService {

    private final UserRepository userRepository;
    private final UserManagementService userManagementService;

    @Transactional(readOnly = true)
    public List<UserManagementDTO> getAssignedUsers(Long coachId) {
        User coachRef = userRepository.getReferenceById(coachId);
        List<User> users = userRepository.findByAssignedCoach(coachRef);
        return users.stream().map(userManagementService::toDTO).collect(Collectors.toList());
    }
}
