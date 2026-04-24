package com.hustlink.backend.features.ai.dto;

import java.time.LocalDateTime;

public record CVUploadResponse(
                               Long id,
                               String fileName,
                               String originalFileName,
                               String mimeType,
                               String storagePath,
                               String downloadUrl,
                               String extractedTextPreview,
                               LocalDateTime uploadedAt,
                               String message) {
}
