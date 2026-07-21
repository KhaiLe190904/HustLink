package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record InterviewStartRequest(Long cvId, Long jobId, Long cvJobAnalysisId, String jobPosition, String level,
                                    List<String> stacks) {
}
