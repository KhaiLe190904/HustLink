package com.hustlink.backend.features.notifications.service;

import com.hustlink.backend.features.notifications.repository.NotificationRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationCleanupScheduler {
  private final NotificationRepository notificationRepository;

  // Run daily at 12:00 AM midnight
  @Scheduled(cron = "0 0 0 * * *")
  @Transactional
  public void cleanupOldNotifications() {
    LocalDateTime threshold = LocalDateTime.now().minusWeeks(2);
    log.info("op=cleanupOldNotifications status=start threshold={}", threshold);
    try {
      int deletedCount = notificationRepository.deleteByCreationDateBefore(threshold);
      log.info("op=cleanupOldNotifications status=success deletedCount={}", deletedCount);
    } catch (Exception e) {
      log.error("op=cleanupOldNotifications status=fail", e);
    }
  }
}
