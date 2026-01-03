package com.hustlink.backend.features.notifications.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity(name = "notifications")
public class Notification {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  private User recipient;
  @ManyToOne
  private User actor;

  private boolean isRead;
  private NotificationType type;
  private Long resourceId;

  @CreationTimestamp
  private LocalDateTime creationDate;

  public Notification(User actor, User recipient, NotificationType type, Long resourceId) {
    this.actor = actor;
    this.recipient = recipient;
    this.type = type;
    this.isRead = false;
    this.resourceId = resourceId;
  }
}
