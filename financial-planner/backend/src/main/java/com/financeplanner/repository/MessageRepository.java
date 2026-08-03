package com.financeplanner.repository;

import com.financeplanner.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findBySenderIdOrReceiverId(Long senderId, Long receiverId);
    void deleteBySenderIdOrReceiverId(Long senderId, Long receiverId);

    // Fetch message history between two specific participants ordered by timestamp ascending
    List<Message> findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByTimestampAsc(
            Long senderId1, Long receiverId1, Long senderId2, Long receiverId2
    );

    long countByReceiverIdAndReadFalse(Long receiverId);

    @Query("SELECT m.senderId, COUNT(m) FROM Message m WHERE m.receiverId = :receiverId AND m.read = false GROUP BY m.senderId")
    List<Object[]> countUnreadGroupedBySender(@Param("receiverId") Long receiverId);

    @Modifying
    @Query("UPDATE Message m SET m.read = true WHERE m.senderId = :senderId AND m.receiverId = :receiverId AND m.read = false")
    void markMessagesAsRead(@Param("senderId") Long senderId, @Param("receiverId") Long receiverId);
}
