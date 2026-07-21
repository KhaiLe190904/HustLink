package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record CVContextDebugResponse(
                                     String originalFileName,
                                     int extractedTextLength,
                                     List<CVSectionDebugResponse> sections,
                                     String fallbackExcerpt,
                                     String retrievalQuery,
                                     String generationContext) {
}
