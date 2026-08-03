package com.financeplanner.repository;

import com.financeplanner.entity.User;
import com.financeplanner.entity.Role;
import com.financeplanner.entity.AccountStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    long countByRole(Role role);
    long countByRoleAndStatus(Role role, AccountStatus status);
    List<User> findTop5ByRoleOrderByCreatedAtDesc(Role role);
    List<User> findTop5ByRoleAndStatusOrderByCreatedAtDesc(Role role, AccountStatus status);
    List<User> findAllByRole(Role role);
    Optional<User> findByIdAndRole(Long id, Role role);
    List<User> findByAssignedCoach(User coach);
    List<User> findByAssignedCoachId(Long coachId);
    List<User> findAllByRoleAndStatus(Role role, AccountStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE " +
            "LOWER(u.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "ORDER BY u.createdAt DESC")
    org.springframework.data.domain.Page<User> searchUsers(@org.springframework.data.repository.query.Param("keyword") String keyword, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u ORDER BY u.createdAt DESC")
    org.springframework.data.domain.Page<User> findAllUsers(org.springframework.data.domain.Pageable pageable);
}
