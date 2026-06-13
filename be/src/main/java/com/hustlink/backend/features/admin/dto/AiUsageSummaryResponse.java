package com.hustlink.backend.features.admin.dto;

import java.math.BigDecimal;
import java.util.Map;

public record AiUsageSummaryResponse(
                                     BigDecimal totalCost,
                                     long totalTokens,
                                     long totalRequests,
                                     Map<String, Long> requestsByType,
                                     Map<String, BigDecimal> costByType
) {
}
