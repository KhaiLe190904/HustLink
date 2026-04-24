package com.hustlink.backend.features.ai.dto;

public record InterviewAnswerRequest(Long questionId, String answerText, Integer durationSeconds) {
}
