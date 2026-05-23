package com.hustlink.backend.features.ai.dto;

import java.util.List;

public record InterviewStartRequest(Long cvId, String jobPosition, String level, List<String> stacks) {
}
