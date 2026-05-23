package com.hustlink.backend.features.ai.rag.dto;

import java.util.List;

public record RagQuestionContext(
                                 String questionText,
                                 String targetPosition,
                                 String level,
                                 String category,
                                 String difficulty,
                                 List<String> expectedPoints,
                                 String source,
                                 String languageCode) {
}
