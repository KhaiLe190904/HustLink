package com.hustlink.backend.features.ai.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CVAnalysisResponse(
                                 Long id,
                                 String originalFileName,
                                 Integer score,
                                 String summary,
                                 List<String> strengths,
                                 List<String> improvements,
                                 LocalDateTime updatedAt) {
}
