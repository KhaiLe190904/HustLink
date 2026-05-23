package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record RagDebugResponse(
                               String phase,
                               int totalRetrieved,
                               int sameLanguageCount,
                               int crossLanguageFallbackCount,
                               List<String> references) {
}
