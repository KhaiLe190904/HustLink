package com.hustlink.backend.features.admin.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "moderation_actions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModerationAction {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "admin_id", nullable = false)
  private User admin;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "target_user_id", nullable = false)
  private User targetUser;

  @Enumerated(EnumType.STRING)
  @Column(name = "action", nullable = false, length = 30)
  private ActionType action;

  @Column(name = "reason", columnDefinition = "nvarchar(1000)")
  private String reason;

  @Column(name = "target_content_id")
  private Long targetContentId;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "expires_at")
  private LocalDateTime expiresAt;
}
