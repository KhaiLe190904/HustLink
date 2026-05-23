package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record CVContextDebugResponse(
                                     String originalFileName,
                                     int extractedTextLength,
                                     boolean hasAnalysisSummary,
                                     List<CVSectionDebugResponse> sections,
                                     String fallbackExcerpt,
                                     String summaryBooster,
                                     String retrievalQuery,
                                     String generationContext) {
}
