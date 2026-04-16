package com.hustlink.backend.features.messaging.controller;

import com.hustlink.backend.dto.Response;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.messaging.dto.MessageDto;
import com.hustlink.backend.features.messaging.model.Conversation;
import com.hustlink.backend.features.messaging.model.Message;
import com.hustlink.backend.features.messaging.service.MessageService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/messaging")
public class MessageController {
  private final MessageService messageService;

  @GetMapping("/conversations")
  public List<Conversation> getConversations(@RequestAttribute("authenticationUser") User user) {
    return messageService.getConversationOfUser(user);
  }

  @GetMapping("/conversations/{conversationId}")
  public Conversation getConversation(@RequestAttribute("authenticationUser") User user, @PathVariable Long conversationId) {
    return messageService.getConversation(user, conversationId);
  }

  @PostMapping("/conversations")
  public Conversation createConversation(@RequestAttribute("authenticationUser") User sender, @RequestBody MessageDto messageDto) {
    return messageService.createConversationAndAddMessage(
            sender, messageDto.receiverId(), messageDto.content(), messageDto.attachmentObjectId(), messageDto.attachmentKind());
  }

  @PostMapping("/conversations/{conversationId}/messages")
  public Message addMessageToConversation(@RequestAttribute("authenticationUser") User sender, @RequestBody MessageDto messageDto, @PathVariable Long conversationId) {
    return messageService.addMessageToConversation(
            conversationId, sender, messageDto.receiverId(), messageDto.content(), messageDto.attachmentObjectId(), messageDto.attachmentKind());
  }

  @PutMapping("/conversations/messages/{messageId}")
  public Response markMessageAsRead(@RequestAttribute("authenticationUser") User user, @PathVariable Long messageId) {
    messageService.markMessageAsRead(user, messageId);
    return new Response("Message marked as read");
  }

  @GetMapping("/conversations/{conversationId}/messages")
  public ResponseEntity<Page<Message>> getMessages(
                                                   @RequestAttribute("authenticationUser") User user, @PathVariable Long conversationId, @PageableDefault(size = 20) Pageable pageable) {
    return ResponseEntity.ok(messageService.getMessages(user, conversationId, pageable));
  }
}
