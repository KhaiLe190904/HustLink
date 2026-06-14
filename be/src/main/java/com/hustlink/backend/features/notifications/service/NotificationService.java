package com.hustlink.backend.features.notifications.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.repository.PostRepository;
import com.hustlink.backend.features.messaging.model.Conversation;
import com.hustlink.backend.features.messaging.model.Message;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import com.hustlink.backend.features.notifications.model.Notification;
import com.hustlink.backend.features.notifications.model.NotificationType;
import com.hustlink.backend.features.notifications.repository.NotificationRepository;
import com.hustlink.backend.features.notifications.dto.NotificationResponseDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {
  private final NotificationRepository notificationRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final com.hustlink.backend.features.authentication.repository.UserRepository userRepository;
  private final PostRepository postRepository;

  private final Map<String, java.util.concurrent.ScheduledFuture<?>> pendingNotifications = new java.util.concurrent.ConcurrentHashMap<>();
  private final java.util.concurrent.ScheduledExecutorService scheduler = java.util.concurrent.Executors.newScheduledThreadPool(2);

  public List<NotificationResponseDto> getUserNotifications(User user) {
    List<Notification> rawList = notificationRepository.findByRecipientOrderByCreationDateDesc(user);
    Map<String, NotificationResponseDto> grouped = new LinkedHashMap<>();

    for (Notification n : rawList) {
      if (n.getType() != NotificationType.LIKE && n.getType() != NotificationType.COMMENT) {
        grouped.put("OTHER_" + n.getId(), new NotificationResponseDto(n, 0));
        continue;
      }

      String key = n.getType() + "_" + n.getResourceId();
      if (!grouped.containsKey(key)) {
        grouped.put(key, new NotificationResponseDto(n, 0));
      } else {
        NotificationResponseDto latest = grouped.get(key);
        latest.addUniqueActor(n.getActor().getId());
        if (!n.isRead()) {
          latest.setRead(false);
        }
      }
    }

    return new ArrayList<>(grouped.values());
  }

  public void sendDeleteNotificationToPost(Long postId) {
    messagingTemplate.convertAndSend("/topic/posts/" + postId + "/delete", postId);
  }

  public void sendEditNotificationToPost(Long postId, Post post) {
    messagingTemplate.convertAndSend("/topic/posts/" + postId + "/edit", post);
  }

  public void sendNewPostNotificationToFeed(Post post) {
    for (Connection connection : post.getAuthor().getInitiatedConnections()) {
      if (connection.getStatus().equals(Status.ACCEPTED)) {
        messagingTemplate.convertAndSend("/topic/feed/" + connection.getRecipient().getId() + "/post", post);
      }
    }
    for (Connection connection : post.getAuthor().getReceivedConnections()) {
      if (connection.getStatus().equals(Status.ACCEPTED)) {
        messagingTemplate.convertAndSend("/topic/feed/" + connection.getAuthor().getId() + "/post", post);
      }
    }
  }

  public void sendLikeToPost(Long postId, Set<User> likes) {
    messagingTemplate.convertAndSend("/topic/likes/" + postId, likes);
  }

  public void sendCommentToPost(Long postId, Comment comment) {
    messagingTemplate.convertAndSend("/topic/comments/" + postId, comment);
  }

  public void sendDeleteCommentToPost(Long postId, Comment comment) {
    messagingTemplate.convertAndSend("/topic/comments/" + postId + "/delete", comment);
  }

  public void sendCommentNotification(User author, User recipient, Long resourceId) {
    if (author.getId().equals(recipient.getId())) {
      return;
    }

    Notification notification = new Notification(author, recipient, NotificationType.COMMENT, resourceId);
    notificationRepository.save(notification);

    messagingTemplate.convertAndSend("/topic/users/" + recipient.getId() + "/notifications", notification);
  }

  public void sendLikeNotification(User author, User recipient, Long resourceId) {
    if (author.getId().equals(recipient.getId())) {
      return;
    }

    Long authorId = author.getId();
    Long recipientId = recipient.getId();
    String key = authorId + "_" + recipientId + "_LIKE_" + resourceId;

    // Cancel any existing pending task
    java.util.concurrent.ScheduledFuture<?> existing = pendingNotifications.remove(key);
    if (existing != null) {
      existing.cancel(false);
    }

    java.util.concurrent.ScheduledFuture<?> future = scheduler.schedule(() -> {
      pendingNotifications.remove(key);
      try {
        if (!postRepository.existsByPostIdAndLikeUserId(resourceId, authorId)) {
          return;
        }
        User freshAuthor = userRepository.findById(authorId).orElse(null);
        User freshRecipient = userRepository.findById(recipientId).orElse(null);
        if (freshAuthor != null && freshRecipient != null) {
          boolean notificationExists = notificationRepository.existsByActorAndRecipientAndTypeAndResourceId(freshAuthor, freshRecipient, NotificationType.LIKE, resourceId);
          if (!notificationExists) {
            Notification notification = new Notification(freshAuthor, freshRecipient, NotificationType.LIKE, resourceId);
            notificationRepository.save(notification);
            messagingTemplate.convertAndSend("/topic/users/" + recipientId + "/notifications", notification);
          }
        }
      } catch (Exception e) {
        e.printStackTrace();
      }
    }, 5, java.util.concurrent.TimeUnit.SECONDS);

    pendingNotifications.put(key, future);
  }

  public void sendJobApplicationNotification(User applicant, User recruiter, Long resourceId) {
    if (applicant.getId().equals(recruiter.getId())) {
      return;
    }

    Notification notification = new Notification(applicant, recruiter, NotificationType.JOB_APPLICATION, resourceId);
    notificationRepository.save(notification);

    messagingTemplate.convertAndSend("/topic/users/" + recruiter.getId() + "/notifications", notification);
  }

  @Transactional
  public void deleteLikeNotification(User author, User recipient, Long resourceId) {
    String key = author.getId() + "_" + recipient.getId() + "_LIKE_" + resourceId;
    java.util.concurrent.ScheduledFuture<?> future = pendingNotifications.remove(key);
    if (future != null) {
      future.cancel(false);
    } else {
      notificationRepository.deleteByActorAndRecipientAndTypeAndResourceId(author, recipient, NotificationType.LIKE, resourceId);
    }
  }

  @Transactional
  public void deleteCommentNotification(User author, User recipient, Long resourceId) {
    notificationRepository.deleteByActorAndRecipientAndTypeAndResourceId(author, recipient, NotificationType.COMMENT, resourceId);
  }

  public Notification markNotificationAsRead(Long notificationId) {
    Notification notification = notificationRepository.findById(notificationId).orElseThrow(() -> new IllegalArgumentException("Notification not found"));
    if (notification.getType() == NotificationType.LIKE || notification.getType() == NotificationType.COMMENT) {
      List<Notification> related = notificationRepository.findByRecipientIdAndTypeAndResourceId(
              notification.getRecipient().getId(), notification.getType(), notification.getResourceId());
      for (Notification r : related) {
        r.setRead(true);
        notificationRepository.save(r);
      }
    } else {
      notification.setRead(true);
      notificationRepository.save(notification);
    }
    messagingTemplate.convertAndSend("/topic/users/" + notification.getRecipient().getId() + "/notifications", notification);
    return notification;
  }

  public void markAllNotificationsAsRead(User recipient) {
    List<Notification> notifications = notificationRepository.findByRecipientOrderByCreationDateDesc(recipient);
    for (Notification notification : notifications) {
      if (!notification.isRead()) {
        notification.setRead(true);
        notificationRepository.save(notification);
        messagingTemplate.convertAndSend("/topic/users/" + recipient.getId() + "/notifications", notification);
      }
    }
  }

  public void sendConversationToUsers(Long senderId, Long receiverId, Conversation conversation) {
    messagingTemplate.convertAndSend("/topic/users/" + senderId + "/conversations", conversation);
    messagingTemplate.convertAndSend("/topic/users/" + receiverId + "/conversations", conversation);
  }

  public void sendMessageToConversation(Long conversationId, Message message) {
    messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/messages", message);
  }

  public void sendNewInvitationToUsers(Long senderId, Long receiverId, Connection connection) {
    messagingTemplate.convertAndSend("/topic/users/" + receiverId + "/connections/new", connection);
    messagingTemplate.convertAndSend("/topic/users/" + senderId + "/connections/new", connection);
  }

  public void sendInvitationAcceptedToUsers(Long senderId, Long receiverId, Connection connection) {
    messagingTemplate.convertAndSend("/topic/users/" + receiverId + "/connections/accepted", connection);
    messagingTemplate.convertAndSend("/topic/users/" + senderId + "/connections/accepted", connection);
  }

  public void sendRemoveConnectionToUsers(Long senderId, Long receiverId, Connection connection) {
    messagingTemplate.convertAndSend("/topic/users/" + receiverId + "/connections/remove", connection);
    messagingTemplate.convertAndSend("/topic/users/" + senderId + "/connections/remove", connection);
  }

  public void sendConnectionSeenNotification(Long id, Connection connection) {
    messagingTemplate.convertAndSend("/topic/users/" + id + "/connections/seen", connection);
  }
}
