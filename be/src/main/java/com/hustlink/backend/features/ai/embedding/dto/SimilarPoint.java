package com.hustlink.backend.features.ai.embedding.dto;

import java.util.Map;

public record SimilarPoint(String id, double score, Map<String, Object> payload) {
}
