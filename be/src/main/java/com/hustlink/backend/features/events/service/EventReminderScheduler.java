package com.hustlink.backend.features.events.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.events.model.*;
import com.hustlink.backend.features.events.repository.EventRepository;
import com.hustlink.backend.features.events.repository.EventRsvpRepository;
import com.hustlink.backend.features.notifications.model.Notification;
import com.hustlink.backend.features.notifications.model.NotificationType;
import com.hustlink.backend.features.notifications.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
@EnableScheduling
public class EventReminderScheduler {
  private final EventRepository eventRepository;
  private final EventRsvpRepository eventRsvpRepository;
  private final NotificationRepository notificationRepository;
  private final SimpMessagingTemplate messagingTemplate;

  // Chạy mỗi giờ quét sự kiện sắp diễn ra trong vòng 24 giờ tới mỗi 12h và 0h đêm và 6h mỗi ngày
  @Scheduled(cron = "0 0 0,6,12,18 * * ?")
  @Transactional
  public void sendEventReminders() {
    LocalDateTime now = LocalDateTime.now();
    LocalDateTime targetTime = now.plusDays(1);
    log.info("op=sendEventReminders scanTimeRange=[{} to {}]", now, targetTime);

    List<Event> upcomingEvents = eventRepository.findByStatus(EventStatus.PUBLISHED).stream().filter(e -> e.getStartAt().isAfter(now) && e.getStartAt().isBefore(targetTime)).toList();

    for (Event event : upcomingEvents) {
      List<EventRsvp> rsvps = eventRsvpRepository.findByEventId(event.getId());
      for (EventRsvp rsvp : rsvps) {
        if (rsvp.getStatus() == RsvpStatus.GOING) {
          List<Notification> existingNotifications = notificationRepository.findByRecipientIdAndTypeAndResourceId(
                  rsvp.getUser().getId(), NotificationType.EVENT_REMINDER, event.getId());

          long minutesRemaining = java.time.Duration.between(now, event.getStartAt()).toMinutes();
          if (minutesRemaining < 0) {
            continue;
          }

          if (existingNotifications.isEmpty()) {
            sendReminder(event, rsvp.getUser());
          } else {
            Notification oldNotification = existingNotifications.get(0);
            boolean replace = false;
            if (minutesRemaining <= 120 && oldNotification.getCreationDate().isBefore(now.minusHours(2))) {
              replace = true;
            } else if (minutesRemaining <= 15 && oldNotification.getCreationDate().isBefore(now.minusMinutes(15))) {
              replace = true;
            }

            if (replace) {
              notificationRepository.delete(oldNotification);
              notificationRepository.flush();
              sendReminder(event, rsvp.getUser());
            }
          }
        }
      }
    }
  }

  private void sendReminder(Event event, User recipient) {
    Notification notification = new Notification(event.getOrganizer(), recipient, NotificationType.EVENT_REMINDER, event.getId());
    notificationRepository.save(notification);
    messagingTemplate.convertAndSend("/topic/users/" + recipient.getId() + "/notifications", notification);
    log.info("op=sendReminder eventId={} recipientId={}", event.getId(), recipient.getId());
  }
}
