package com.financeplanner.repository;

import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.AccountStatus;
import com.financeplanner.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CoachProfileRepository extends JpaRepository<CoachProfile, Long> {

    @Query("SELECT cp FROM CoachProfile cp JOIN FETCH cp.user ORDER BY cp.user.createdAt DESC")
    List<CoachProfile> findAllWithUserOrderByCreatedAtDesc();

    @Query("SELECT cp FROM CoachProfile cp JOIN FETCH cp.user u WHERE u.id = :userId")
    Optional<CoachProfile> findByUserIdWithUser(@Param("userId") Long userId);

    Optional<CoachProfile> findByUser(User user);

    @Query("SELECT cp FROM CoachProfile cp JOIN FETCH cp.user u WHERE u.status = :status ORDER BY u.createdAt DESC")
    List<CoachProfile> findAllByUserStatusWithUser(@Param("status") AccountStatus status);

    @Query("SELECT cp FROM CoachProfile cp JOIN FETCH cp.user u WHERE " +
            "LOWER(u.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(cp.areaOfExpertise) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(cp.qualification) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "ORDER BY u.createdAt DESC")
    List<CoachProfile> searchCoaches(@Param("keyword") String keyword);
}
