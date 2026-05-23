package com.hustlink.backend.features.ai.rag.dto;

import java.util.Map;

public record RagStatsResponse(
                               long totalQuestions,
                               Map<String, Long> byLevel,
                               Map<String, Long> byLanguage,
                               Map<String, Long> byCategory) {
}
