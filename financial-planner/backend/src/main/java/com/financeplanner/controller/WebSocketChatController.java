package com.financeplanner.controller;

import com.financeplanner.dto.ChatMessageRequest;
import com.financeplanner.dto.MessageDTO;
import com.financeplanner.entity.Message;
import com.financeplanner.entity.User;
import com.financeplanner.repository.MessageRepository;
import com.financeplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessageRequest request, Principal principal) {
        if (principal == null) {
            return; // unauthenticated, ignore
        }

        String senderEmail = principal.getName();
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new RuntimeException("Sender not found: " + senderEmail));

        Long senderId = sender.getId();
        Long receiverId = request.getReceiverId();

        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        Message msg = new Message();
        msg.setSenderId(senderId);
        msg.setReceiverId(receiverId);
        msg.setContent(request.getContent());
        msg.setTimestamp(LocalDateTime.now());
        msg.setRead(false);

        Message saved = messageRepository.save(msg);

        MessageDTO dto = new MessageDTO(
                saved.getId(), saved.getSenderId(), saved.getReceiverId(), saved.getContent(), saved.getTimestamp()
        );

        // Send to receiver
        messagingTemplate.convertAndSendToUser(
                receiver.getEmail(),
                "/queue/messages",
                dto
        );

        // Echo back to sender so their ChatBox also updates in real-time
        messagingTemplate.convertAndSendToUser(
                sender.getEmail(),
                "/queue/messages",
                dto
        );
    }
}
