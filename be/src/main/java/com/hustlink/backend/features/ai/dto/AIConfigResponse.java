package com.hustlink.backend.features.ai.dto;

public record AIConfigResponse(
                               boolean geminiConfigured,
                               int dailyAnalysisLimit,
                               long remainingAnalysesToday) {
}
