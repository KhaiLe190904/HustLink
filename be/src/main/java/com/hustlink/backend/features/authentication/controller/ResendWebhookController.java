package com.hustlink.backend.features.authentication.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/webhooks/resend")
public class ResendWebhookController {

  private static final Logger logger = LoggerFactory.getLogger(ResendWebhookController.class);

  private final UserRepository userRepository;

  @PostMapping
  public ResponseEntity<Void> handleWebhook(@RequestBody Map<String, Object> payload) {
    try {
      logger.info("Received Resend webhook: {}", payload);
      String type = (String) payload.get("type");
      @SuppressWarnings("unchecked") Map<String, Object> data = (Map<String, Object>) payload.get("data");

      if (data == null) {
        logger.warn("Webhook payload missing 'data' field");
        return ResponseEntity.ok().build();
      }

      // Resend webhook uses "email_id" not "id"
      String messageId = (String) data.get("email_id");

      // "to" can be either a string or an array, handle both cases
      String to = null;
      Object toObj = data.get("to");
      if (toObj instanceof String) {
        to = (String) toObj;
      } else if (toObj instanceof java.util.List) {
        @SuppressWarnings("unchecked") java.util.List<String> toList = (java.util.List<String>) toObj;
        if (!toList.isEmpty()) {
          to = toList.get(0);
        }
      }

      logger.info("Webhook event: type={}, messageId={}, to={}", type, messageId, to);

      if (messageId == null || to == null) {
        logger.warn("Webhook payload missing 'email_id' or 'to' field. messageId={}, to={}", messageId, to);
        return ResponseEntity.ok().build();
      }

      User user = userRepository.findByEmail(to).orElse(null);

      if (user == null) {
        logger.warn("User not found for email: {}", to);
        return ResponseEntity.ok().build();
      }

      // Match messageId to ensure we're updating the correct email verification attempt
      String storedMessageId = user.getEmailVerificationProviderMessageId();
      if (storedMessageId != null && !storedMessageId.equals(messageId)) {
        logger.warn("MessageId mismatch. Stored: {}, Received: {}. Skipping update.", storedMessageId, messageId);
        return ResponseEntity.ok().build();
      }

      if ("email.bounced".equals(type)) {
        logger.info("Email bounced for user: {} (messageId: {})", to, messageId);
        user.setEmailVerificationDeliveryStatus("bounced");
      } else if ("email.delivered".equals(type)) {
        logger.info("Email delivered for user: {} (messageId: {})", to, messageId);
        user.setEmailVerificationDeliveryStatus("delivered");
      }
      userRepository.save(user);
      logger.info("Updated email delivery status for user: {} to {} (messageId: {})", to, user.getEmailVerificationDeliveryStatus(), messageId);
    } catch (Exception e) {
      logger.error("Error handling Resend webhook", e);
    }

    return ResponseEntity.ok().build();
  }
}
