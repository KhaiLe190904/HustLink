package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.model.AIUsageType;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AIUsageLogRepository extends JpaRepository<AIUsageLog, Long> {
  long countByUserIdAndUsageTypeAndUsedAtBetween(
                                                 Long userId, AIUsageType usageType, LocalDateTime start, LocalDateTime end);
}
