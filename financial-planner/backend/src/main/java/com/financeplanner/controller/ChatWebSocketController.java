package com.financeplanner.controller;

import com.financeplanner.dto.ChatMessageDTO;
import com.financeplanner.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    public void processMessage(ChatMessageDTO chatMessage) {
        if (chatMessage.getSenderId() == null || chatMessage.getReceiverId() == null) {
            return;
        }

        ChatMessageDTO savedDTO = chatService.sendMessage(
                chatMessage.getSenderId(),
                chatMessage.getReceiverId(),
                chatMessage.getContent()
        );

        long min = Math.min(chatMessage.getSenderId(), chatMessage.getReceiverId());
        long max = Math.max(chatMessage.getSenderId(), chatMessage.getReceiverId());
        String topic = "/topic/chat/" + min + "_" + max;

        messagingTemplate.convertAndSend(topic, savedDTO);
    }
}
