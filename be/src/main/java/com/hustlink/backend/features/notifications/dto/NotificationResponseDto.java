package com.hustlink.backend.features.notifications.dto;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.notifications.model.Notification;
import com.hustlink.backend.features.notifications.model.NotificationType;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class NotificationResponseDto {
  private Long id;
  private User recipient;
  private User actor;
  private boolean isRead;
  private NotificationType type;
  private Long resourceId;
  private LocalDateTime creationDate;
  private int additionalActorsCount;

  private Set<Long> uniqueActors = new HashSet<>();

  public NotificationResponseDto(Notification n, int additionalCount) {
    this.id = n.getId();
    this.recipient = n.getRecipient();
    this.actor = n.getActor();
    this.isRead = n.isRead();
    this.type = n.getType();
    this.resourceId = n.getResourceId();
    this.creationDate = n.getCreationDate();
    this.additionalActorsCount = additionalCount;
  }

  public void addUniqueActor(Long actorId) {
    if (!actorId.equals(this.actor.getId())) {
      if (uniqueActors.add(actorId)) {
        this.additionalActorsCount = uniqueActors.size();
      }
    }
  }
}
