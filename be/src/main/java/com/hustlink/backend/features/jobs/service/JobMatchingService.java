package com.hustlink.backend.features.jobs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.EmbeddingService;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.service.CVContextBuilder;
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
  private final ObjectMapper objectMapper;
  private final CVContextBuilder cvContextBuilder;

  public record MatchResult(int score, String breakdown, String reasoning) {
  }

  @Cacheable(value = "jobMatchingCache", key = "{#cv.id, #cv.updatedAt, #job.id, #job.title, #job.description, #job.requirements, #job.responsibilities, #job.experienceLevel, #job.skills == null ? 0 : #job.skills.hashCode()}")
  public MatchResult computeMatch(CV cv, Job job) {
    return computeMatch(cv, job, extractJobSkillsPresentInCv(cv.getExtractedText(), job.getSkills()));
  }

  public MatchResult computeMatch(CV cv, Job job, List<String> cvSkills) {
    return computeMatch(cv, job, cvSkills, List.of(), List.of());
  }

  public MatchResult computeMatch(CV cv, Job job, List<String> cvSkills, List<String> matchReasons, List<String> matchGaps) {
    log.info("op=computeMatch cvId={} jobId={}", cv.getId(), job.getId());

    // 1. Semantic Score (60%)
    String cleanCvContext = cvContextBuilder.buildStructuredCvContext(cv, 3200, 1000);
    String jobContext = buildJobContext(job);
    float[] cvVector = embeddingService.embed(cleanCvContext);
    float[] jobVector = embeddingService.embed(jobContext);
    double similarity = cosineSimilarity(cvVector, jobVector);
    int semanticScore = (int) Math.max(0, Math.min(100, similarity * 100));

    // 2. Skill Overlap (20%)
    int skillScore = calculateSkillOverlap(cvSkills, job.getSkills());

    // 3. Experience Match (10%)
    int experienceScore = calculateExperienceScore(cv.getExtractedText(), job.getExperienceLevel());

    // 4. Keyword Boost (10%)
    int keywordScore = calculateKeywordBoost(cv.getExtractedText(), job.getSkills());

    // Compute aggregate score
    int totalScore = (int) Math.round(
            0.60 * semanticScore + 0.20 * skillScore + 0.10 * experienceScore + 0.10 * keywordScore
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

    Map<String, List<String>> reasoningMap = new LinkedHashMap<>();
    reasoningMap.put("reasons", matchReasons == null ? List.of() : matchReasons);
    reasoningMap.put("gaps", matchGaps == null ? List.of() : matchGaps);
    String reasoningJson;
    try {
      reasoningJson = objectMapper.writeValueAsString(reasoningMap);
    } catch (JsonProcessingException e) {
      reasoningJson = "{}";
    }

    return new MatchResult(totalScore, breakdownJson, reasoningJson);
  }

  public String buildJobContext(Job job) {
    StringBuilder builder = new StringBuilder();
    append(builder, "Title", job.getTitle());
    append(builder, "Company", job.getCompany() == null ? "" : job.getCompany().getName());
    append(builder, "Description", job.getDescription());
    append(builder, "Requirements", job.getRequirements());
    append(builder, "Responsibilities and benefits", job.getResponsibilities());
    append(builder, "Location", job.getLocation());
    append(builder, "Experience level", job.getExperienceLevel());
    if (job.getSkills() != null && !job.getSkills().isEmpty()) {
      append(builder, "Skills", String.join(", ", job.getSkills()));
    }
    append(builder, "Raw imported JD", job.getRawImportedContent());
    return builder.toString().trim();
  }

  private void append(StringBuilder builder, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    builder.append(label).append(":\n").append(value.trim()).append("\n\n");
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

  private int calculateSkillOverlap(List<String> cvSkills, Set<String> jobSkills) {
    if (jobSkills == null || jobSkills.isEmpty()) {
      return 100;
    }
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

  private List<String> extractJobSkillsPresentInCv(String cvText, Set<String> jobSkills) {
    if (cvText == null || cvText.isBlank() || jobSkills == null || jobSkills.isEmpty()) {
      return List.of();
    }
    String text = cvText.toLowerCase();
    return jobSkills.stream().filter(skill -> skill != null && !skill.isBlank()).filter(skill -> text.contains(skill.toLowerCase())).toList();
  }

}
