package com.financeplanner.repository;

import com.financeplanner.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdAndReadFalse(Long userId);
    List<Notification> findByUserId(Long userId);
    void deleteByUserId(Long userId);
    int countByUserIdAndReadFalse(Long userId);
}
