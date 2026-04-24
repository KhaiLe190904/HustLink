package com.hustlink.backend.features.ai.dto;

public record InterviewStartResponse(
                                     Long sessionId,
                                     Long cvId,
                                     String cvFileName,
                                     String jobPosition,
                                     String languageCode,
                                     int totalQuestions,
                                     int answerTimeLimitSeconds,
                                     InterviewQuestionResponse currentQuestion) {
}
