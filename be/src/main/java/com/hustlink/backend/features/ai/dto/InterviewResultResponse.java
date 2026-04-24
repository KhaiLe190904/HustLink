package com.hustlink.backend.features.ai.dto;

import java.time.LocalDateTime;
import java.util.List;

public record InterviewResultResponse(
                                      Long sessionId,
                                      Long cvId,
                                      String cvFileName,
                                      String jobPosition,
                                      String languageCode,
                                      Integer overallScore,
                                      String summary,
                                      List<String> strengths,
                                      List<String> improvements,
                                      List<InterviewAnswerReviewResponse> reviews,
                                      LocalDateTime completedAt) {
}
