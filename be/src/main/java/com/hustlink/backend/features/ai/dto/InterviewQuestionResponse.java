package com.hustlink.backend.features.ai.dto;

public record InterviewQuestionResponse(
                                        Long id,
                                        int questionOrder,
                                        int totalQuestions,
                                        String category,
                                        String text,
                                        int answerTimeLimitSeconds) {
}
