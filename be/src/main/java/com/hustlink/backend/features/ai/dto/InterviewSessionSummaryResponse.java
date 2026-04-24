package com.hustlink.backend.features.ai.dto;

import java.time.LocalDateTime;

public record InterviewSessionSummaryResponse(
                                              Long sessionId,
                                              Long cvId,
                                              String cvFileName,
                                              String jobPosition,
                                              String languageCode,
                                              String status,
                                              Integer totalQuestions,
                                              Integer answeredQuestions,
                                              Integer overallScore,
                                              LocalDateTime startedAt,
                                              LocalDateTime completedAt) {
}
