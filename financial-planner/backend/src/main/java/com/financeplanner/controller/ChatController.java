package com.financeplanner.controller;

import com.financeplanner.dto.ChatMessageRequest;
import com.financeplanner.dto.MessageDTO;
import com.financeplanner.dto.PartnerDTO;
import com.financeplanner.entity.Message;
import com.financeplanner.entity.User;
import com.financeplanner.repository.MessageRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    @GetMapping("/api/chat/history")
    public ResponseEntity<?> getChatHistory(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long partnerId) {

        List<Message> history = messageRepository.findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByTimestampAsc(
                currentUser.getId(), partnerId, partnerId, currentUser.getId()
        );

        List<MessageDTO> dtos = history.stream().map(m -> new MessageDTO(
                m.getId(), m.getSenderId(), m.getReceiverId(), m.getContent(), m.getTimestamp()
        )).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/api/chat/my-coach")
    public ResponseEntity<?> getMyCoach(@AuthenticationPrincipal User user) {
        if (user.getAssignedCoach() != null) {
            User coach = user.getAssignedCoach();
            return ResponseEntity.ok(new PartnerDTO(coach.getId(), coach.getName(), coach.getRole().name()));
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/api/chat/unread-count")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal User currentUser) {
        long count = messageRepository.countByReceiverIdAndReadFalse(currentUser.getId());
        List<Object[]> grouped = messageRepository.countUnreadGroupedBySender(currentUser.getId());
        java.util.Map<Long, Long> bySender = new java.util.HashMap<>();
        for (Object[] row : grouped) {
            bySender.put((Long) row[0], (Long) row[1]);
        }
        return ResponseEntity.ok(java.util.Map.of("unreadCount", count, "bySender", bySender));
    }

    @PutMapping("/api/chat/mark-read")
    @Transactional
    public ResponseEntity<?> markAsRead(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long partnerId) {
        messageRepository.markMessagesAsRead(partnerId, currentUser.getId());
        return ResponseEntity.ok().build();
    }
}
