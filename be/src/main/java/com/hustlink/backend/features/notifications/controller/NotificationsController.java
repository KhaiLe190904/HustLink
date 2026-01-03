package com.hustlink.backend.features.notifications.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.notifications.model.Notification;
import com.hustlink.backend.features.notifications.service.NotificationService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationsController {
  private final NotificationService notificationService;

  @GetMapping
  public List<Notification> getUserNotifications(@RequestAttribute("authenticationUser") User user) {
    return notificationService.getUserNotifications(user);
  }

  @PutMapping("/{notificationId}")
  public Notification markNotificationAsRead(@PathVariable Long notificationId) {
    return notificationService.markNotificationAsRead(notificationId);
  }
}
