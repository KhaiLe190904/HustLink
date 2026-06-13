package com.hustlink.backend.features.notifications.repository;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.notifications.model.Notification;
import com.hustlink.backend.features.notifications.model.NotificationType;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
  List<Notification> findByRecipient(User recipient);

  List<Notification> findByRecipientOrderByCreationDateDesc(User user);

  boolean existsByRecipientIdAndTypeAndResourceId(Long recipientId, com.hustlink.backend.features.notifications.model.NotificationType type, Long resourceId);

  List<Notification> findByRecipientIdAndTypeAndResourceId(Long recipientId, NotificationType type, Long resourceId);

  @Transactional
  void deleteByActorAndRecipientAndTypeAndResourceId(User actor, User recipient, NotificationType type, Long resourceId);

  @Modifying
  @Transactional
  @Query("DELETE FROM notifications n WHERE n.creationDate < :threshold")
  int deleteByCreationDateBefore(@Param("threshold") LocalDateTime threshold);

  @Transactional
  void deleteByResourceIdAndType(Long resourceId, NotificationType type);
}
