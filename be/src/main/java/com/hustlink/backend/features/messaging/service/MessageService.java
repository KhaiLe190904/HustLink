package com.hustlink.backend.features.messaging.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.service.AuthenticationService;
import com.hustlink.backend.features.messaging.model.Conversation;
import com.hustlink.backend.features.messaging.model.Message;
import com.hustlink.backend.features.messaging.repository.ConversationRepository;
import com.hustlink.backend.features.messaging.repository.MessageRepository;
import com.hustlink.backend.features.notifications.service.NotificationService;
import jakarta.transaction.Transactional;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MessageService {
  private final ConversationRepository conversationRepository;
  private final AuthenticationService authenticationService;
  private final MessageRepository messageRepository;
  private final NotificationService notificationService;
  private final SimpMessagingTemplate messagingTemplate;

  public List<Conversation> getConversationOfUser(User user) {
    return conversationRepository.findByAuthorOrRecipient(user, user);
  }

  public Conversation getConversation(User user, Long conversationId) {
    Conversation conversation = conversationRepository.findById(conversationId).orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
    if (!conversation.getAuthor().getId().equals(user.getId()) && !conversation.getRecipient().getId().equals(user.getId())) {
      throw new IllegalArgumentException("You are not allowed to access this conversation");
    }
    return conversation;
  }

  @Transactional
  public Conversation createConversationAndAddMessage(User sender, Long receiverId, String content) {
    User receiver = authenticationService.getUserById(receiverId);
    conversationRepository.findByAuthorAndRecipient(sender, receiver).ifPresentOrElse(conversation -> {
      throw new IllegalArgumentException(
              "Conversation already exists, use the conversation id to send messages.");
    }, () -> {
    });

    conversationRepository.findByAuthorAndRecipient(receiver, sender).ifPresentOrElse(conversation -> {
      throw new IllegalArgumentException(
              "Conversation already exists, use the conversation id to send messages.");
    }, () -> {
    });

    Conversation conversation = conversationRepository.save(new Conversation(sender, receiver));
    Message message = new Message(sender, receiver, conversation, content);
    messageRepository.save(message);
    conversation.getMessages().add(message);
    notificationService.sendConversationToUsers(sender.getId(), receiver.getId(), conversation);
    return conversation;
  }

  public Message addMessageToConversation(Long conversationId, User sender, Long receiverId, String content) {
    User receiver = authenticationService.getUserById(receiverId);
    Conversation conversation = conversationRepository.findById(conversationId).orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

    if (!conversation.getAuthor().getId().equals(sender.getId()) && !conversation.getRecipient().getId().equals(sender.getId())) {
      throw new IllegalArgumentException("You are not allowed to access this conversation");
    }

    if (!conversation.getAuthor().getId().equals(receiver.getId()) && !conversation.getRecipient().getId().equals(receiver.getId())) {
      throw new IllegalArgumentException("Receiver doesn't belong to this conversation");
    }

    Message message = new Message(sender, receiver, conversation, content);
    messageRepository.save(message);
    conversation.getMessages().add(message);
    notificationService.sendMessageToConversation(conversation.getId(), message);
    notificationService.sendConversationToUsers(sender.getId(), receiver.getId(), conversation);
    return message;
  }

  public void markMessageAsRead(User user, Long messageId) {
    Message message = messageRepository.findById(messageId).orElseThrow(() -> new IllegalArgumentException("Message not found"));
    if (!message.getReceiver().getId().equals(user.getId())) {
      throw new IllegalArgumentException("You are not allowed to access this message");
    }
    message.setRead(true);
    messageRepository.save(message);
    notificationService.sendMessageToConversation(message.getConversation().getId(), message);
  }
}
