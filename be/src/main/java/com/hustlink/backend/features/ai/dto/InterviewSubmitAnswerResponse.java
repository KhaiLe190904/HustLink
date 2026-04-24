package com.hustlink.backend.features.ai.dto;

public record InterviewSubmitAnswerResponse(
                                            Long sessionId,
                                            boolean completed,
                                            int answeredQuestions,
                                            int totalQuestions,
                                            InterviewQuestionResponse nextQuestion,
                                            InterviewResultResponse results) {
}
