package com.hustlink.backend.features.ai.dto;

import java.time.LocalDateTime;

public record CVSummaryResponse(
                                Long id,
                                String fileName,
                                String originalFileName,
                                String mimeType,
                                String downloadUrl,
                                LocalDateTime uploadedAt) {
}
