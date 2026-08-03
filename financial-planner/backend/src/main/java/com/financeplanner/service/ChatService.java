package com.financeplanner.service;

import com.financeplanner.dto.ChatMessageDTO;
import com.financeplanner.entity.Message;
import com.financeplanner.entity.User;
import com.financeplanner.repository.MessageRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("hh:mm a, dd MMM");

    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getChatHistory(Long currentUserId, Long partnerId) {
        validateAssignment(currentUserId, partnerId);

        List<Message> messages = messageRepository.findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByTimestampAsc(
                currentUserId, partnerId, partnerId, currentUserId
        );

        return messages.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, Long receiverId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Message content cannot be empty");
        }

        validateAssignment(senderId, receiverId);

        Message message = new Message();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setContent(content.trim());
        message.setTimestamp(LocalDateTime.now());
        message.setRead(false);

        Message saved = messageRepository.save(message);
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAssignedCoachForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        User coach = user.getAssignedCoach();
        if (coach == null) {
            return Map.of("hasCoach", false);
        }

        return Map.of(
                "hasCoach", true,
                "coachId", coach.getId(),
                "coachName", coach.getName(),
                "coachEmail", coach.getEmail()
        );
    }

    public void validateAssignment(Long userId1, Long userId2) {
        User u1 = userRepository.findById(userId1)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId1));
        User u2 = userRepository.findById(userId2)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId2));

        boolean isU1CoachOfU2 = u2.getAssignedCoach() != null && u2.getAssignedCoach().getId().equals(u1.getId());
        boolean isU2CoachOfU1 = u1.getAssignedCoach() != null && u1.getAssignedCoach().getId().equals(u2.getId());

        if (!isU1CoachOfU2 && !isU2CoachOfU1) {
            throw new RuntimeException("Unauthorized: You can only communicate with your assigned coach or user.");
        }
    }

    private ChatMessageDTO toDTO(Message msg) {
        return ChatMessageDTO.builder()
                .id(msg.getId())
                .senderId(msg.getSenderId())
                .receiverId(msg.getReceiverId())
                .content(msg.getContent())
                .timestamp(msg.getTimestamp() != null ? msg.getTimestamp().format(TIME_FMT) : "")
                .build();
    }
}
