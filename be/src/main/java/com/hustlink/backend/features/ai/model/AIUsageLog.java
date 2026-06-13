package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;


@Entity
@Table(name = "ai_usage_logs", indexes = {@Index(name = "idx_ai_usage_logs_user_type_used_at", columnList = "user_id, usage_type, used_at")
})
@Getter
@Setter
public class AIUsageLog {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  @JsonIgnore
  private User user;

  @Enumerated(EnumType.STRING)
  @Column(name = "usage_type", nullable = false, length = 50)
  private AIUsageType usageType;

  @Column(name = "used_at", nullable = false)
  private LocalDateTime usedAt;

  @Column(name = "prompt_tokens")
  private Integer promptTokens = 0;

  @Column(name = "completion_tokens")
  private Integer completionTokens = 0;

  @Column(name = "estimated_cost_usd", precision = 10, scale = 6)
  private BigDecimal estimatedCostUsd = BigDecimal.ZERO;


  @PrePersist
  void onCreate() {
    if (usedAt == null) {
      usedAt = LocalDateTime.now();
    }
  }
}
