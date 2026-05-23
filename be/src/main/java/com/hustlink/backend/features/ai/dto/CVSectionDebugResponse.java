package com.hustlink.backend.features.ai.dto;

public record CVSectionDebugResponse(
                                     String key,
                                     String label,
                                     boolean found,
                                     int charCount,
                                     String content) {
}
