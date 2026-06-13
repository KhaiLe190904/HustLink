package com.hustlink.backend.features.jobs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.EmbeddingService;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.service.GeminiService;
import com.hustlink.backend.features.jobs.model.Job;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobMatchingService {
  private final EmbeddingService embeddingService;
  private final GeminiService geminiService;
  private final ObjectMapper objectMapper;
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };

  public record MatchResult(int score, String breakdown, String reasoning) {
  }

  @Cacheable(value = "jobMatchingCache", key = "{#cv.id, #job.id}")
  public MatchResult computeMatch(CV cv, Job job) {
    log.info("op=computeMatch cvId={} jobId={}", cv.getId(), job.getId());

    // 1. Semantic Score (50%)
    float[] cvVector = embeddingService.embed(cv.getExtractedText());
    float[] jobVector = embeddingService.embed(job.getTitle() + "\n" + job.getDescription());
    double similarity = cosineSimilarity(cvVector, jobVector);
    int semanticScore = (int) Math.max(0, Math.min(100, similarity * 100));

    // 2. Skill Overlap (30%)
    int skillScore = calculateSkillOverlap(cv.getExtractedSkills(), job.getSkills());

    // 3. Experience Match (15%)
    int experienceScore = calculateExperienceScore(cv.getExtractedText(), job.getExperienceLevel());

    // 4. Keyword Boost (5%)
    int keywordScore = calculateKeywordBoost(cv.getExtractedText(), job.getSkills());

    // Compute aggregate score
    int totalScore = (int) Math.round(
            0.50 * semanticScore + 0.30 * skillScore + 0.15 * experienceScore + 0.05 * keywordScore
    );

    // Breakdown JSON
    Map<String, Integer> breakdownMap = new LinkedHashMap<>();
    breakdownMap.put("semantic", semanticScore);
    breakdownMap.put("skills", skillScore);
    breakdownMap.put("experience", experienceScore);
    breakdownMap.put("keywords", keywordScore);
    String breakdownJson;
    try {
      breakdownJson = objectMapper.writeValueAsString(breakdownMap);
    } catch (JsonProcessingException e) {
      breakdownJson = "{}";
    }

    // Gemini Match Reasoning
    GeminiService.JobMatchInsight insight = geminiService.generateMatchReasoning(
            cv.getExtractedText(), job.getTitle(), job.getDescription(), job.getSkills()
    );

    Map<String, List<String>> reasoningMap = new LinkedHashMap<>();
    reasoningMap.put("reasons", insight.reasons());
    reasoningMap.put("gaps", insight.gaps());
    String reasoningJson;
    try {
      reasoningJson = objectMapper.writeValueAsString(reasoningMap);
    } catch (JsonProcessingException e) {
      reasoningJson = "{}";
    }

    return new MatchResult(totalScore, breakdownJson, reasoningJson);
  }

  private double cosineSimilarity(float[] vectorA, float[] vectorB) {
    if (vectorA == null || vectorB == null || vectorA.length != vectorB.length) {
      return 0.0;
    }
    double dotProduct = 0.0;
    double normA = 0.0;
    double normB = 0.0;
    for (int i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    if (normA == 0.0 || normB == 0.0) {
      return 0.0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private int calculateSkillOverlap(String cvSkillsJson, Set<String> jobSkills) {
    if (jobSkills == null || jobSkills.isEmpty()) {
      return 100;
    }
    List<String> cvSkills = readList(cvSkillsJson);
    if (cvSkills.isEmpty()) {
      return 0;
    }

    long matchCount = jobSkills.stream().filter(js -> cvSkills.stream().anyMatch(cs -> cs.toLowerCase().contains(js.toLowerCase()) || js.toLowerCase().contains(cs.toLowerCase()))).count();

    return (int) (((double) matchCount / jobSkills.size()) * 100);
  }

  private int calculateExperienceScore(String cvText, String experienceLevel) {
    if (experienceLevel == null || experienceLevel.isBlank()) return 80;
    String level = experienceLevel.trim().toUpperCase();
    String text = cvText.toLowerCase();

    int years = 0;
    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)\\s*(?:year|năm)");
    java.util.regex.Matcher matcher = pattern.matcher(text);
    if (matcher.find()) {
      years = Integer.parseInt(matcher.group(1));
    }

    switch (level) {
      case "INTERN":
      case "FRESHER":
        return years <= 1 ? 100 : 70;
      case "JUNIOR":
        return (years >= 1 && years <= 3) ? 100 : (years < 1 ? 60 : 80);
      case "MIDDLE":
      case "MID":
        return (years >= 2 && years <= 5) ? 100 : (years < 2 ? 50 : 85);
      case "SENIOR":
        return years >= 5 ? 100 : (years >= 3 ? 70 : 40);
      case "LEAD":
      case "PRINCIPAL":
        return years >= 7 ? 100 : (years >= 5 ? 70 : 30);
      default:
        return 80;
    }
  }

  private int calculateKeywordBoost(String cvText, Set<String> jobSkills) {
    if (jobSkills == null || jobSkills.isEmpty()) {
      return 100;
    }
    String text = cvText.toLowerCase();
    long count = jobSkills.stream().filter(skill -> text.contains(skill.toLowerCase())).count();
    return (int) (((double) count / jobSkills.size()) * 100);
  }

  private List<String> readList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(value, STRING_LIST);
    } catch (JsonProcessingException exception) {
      return List.of();
    }
  }
}
