package com.hustlink.backend.features.ai.rag.dto;

import com.hustlink.backend.features.ai.model.InterviewQuestionCategory;
import java.util.List;

public record InterviewQuestionBankImportRequest(
                                                 String questionText,
                                                 String targetPosition,
                                                 String level,
                                                 InterviewQuestionCategory category,
                                                 String difficulty,
                                                 List<String> expectedPoints,
                                                 String source,
                                                 String languageCode) {
}
