package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record InterviewAnswerReviewResponse(
                                            Long questionId,
                                            int questionOrder,
                                            String category,
                                            String questionText,
                                            String answerText,
                                            Integer durationSeconds,
                                            Integer score,
                                            String feedback,
                                            List<String> strengths,
                                            List<String> improvements) {
}
