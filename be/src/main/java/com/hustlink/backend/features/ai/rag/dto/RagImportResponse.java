package com.hustlink.backend.features.ai.rag.dto;

public record RagImportResponse(
                                int importedCount,
                                int skippedCount,
                                int remainingCount) {
}
