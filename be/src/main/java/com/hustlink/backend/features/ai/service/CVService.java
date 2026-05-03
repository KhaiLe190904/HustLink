package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.dto.AIConfigResponse;
import com.hustlink.backend.features.ai.dto.CVAnalysisResponse;
import com.hustlink.backend.features.ai.dto.CVSummaryResponse;
import com.hustlink.backend.features.ai.dto.CVUploadResponse;
import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.model.AIUsageType;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.ai.repository.InterviewSessionRepository;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import com.hustlink.backend.features.storage.service.ObjectStorageService;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CVService {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };

  private final CVRepository cvRepository;
  private final AIUsageLogRepository aiUsageLogRepository;
  private final InterviewSessionRepository interviewSessionRepository;
  private final CVParserService cvParserService;
  private final GeminiService geminiService;
  private final ObjectStorageService objectStorageService;
  private final ObjectMapper objectMapper;

  @Value("${ai.daily-analysis-limit:2}")
  private int dailyAnalysisLimit;

  public CVUploadResponse uploadCv(User user, MultipartFile file) {
    validatePdf(file);

    String extractedText;
    try {
      extractedText = cvParserService.extractTextFromPdf(file);
    } catch (IOException exception) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "The uploaded file is not a valid readable PDF.", exception);
    }

    if (extractedText.isBlank()) {
      throw new IllegalArgumentException("Could not extract any text from this PDF.");
    }

    String originalFileName = file.getOriginalFilename() == null ? "cv.pdf" : file.getOriginalFilename();
    StoredObject storedObject = objectStorageService.upload(file, StorageScope.CV, user, "USER_CV", user.getId());
    String storedFileName = storedObject.getObjectKey();

    CV cv = new CV();
    cv.setUser(user);
    cv.setFileName(storedFileName);
    cv.setOriginalFileName(originalFileName);
    cv.setBucketName(storedObject.getBucketName());
    cv.setObjectKey(storedObject.getObjectKey());
    cv.setMimeType(file.getContentType() == null ? "application/pdf" : file.getContentType());
    cv.setExtractedText(extractedText);
    cv.setStoredObject(storedObject);

    CV savedCv = cvRepository.save(cv);
    return new CVUploadResponse(
            savedCv.getId(), savedCv.getFileName(), savedCv.getOriginalFileName(), savedCv.getMimeType(), objectStorageService.getPublicPath(storedObject), objectStorageService.getAccessUrl(storedObject), previewText(savedCv.getExtractedText()), savedCv.getUploadedAt(), "CV uploaded successfully.");
  }

  public List<CVSummaryResponse> getMyCvs(User user) {
    return cvRepository.findByUserIdOrderByUploadedAtDesc(user.getId()).stream().map(cv -> new CVSummaryResponse(
            cv.getId(), cv.getFileName(), cv.getOriginalFileName(), cv.getMimeType(), objectStorageService.getAccessUrl(cv.getStoredObject()), cv.getAnalysisScore(), cv.getAnalysisScore() != null, cv.getUploadedAt())).toList();
  }

  @Transactional
  public void deleteCv(User user, Long cvId) {
    CV cv = cvRepository.findByIdAndUserId(cvId, user.getId()).orElseThrow(() -> new IllegalArgumentException("CV not found."));
    if (interviewSessionRepository.existsByCvId(cvId)) {
      throw new ResponseStatusException(
              HttpStatus.CONFLICT, "This CV already has interview history and cannot be deleted.");
    }
    StoredObject storedObject = cv.getStoredObject();
    cvRepository.delete(cv);
    cvRepository.flush();
    if (storedObject != null) {
      objectStorageService.delete(storedObject);
    }
  }

  public CVAnalysisResponse analyzeCv(User user, Long cvId) {
    CV cv = cvRepository.findByIdAndUserId(cvId, user.getId()).orElseThrow(() -> new IllegalArgumentException("CV not found."));

    if (cv.getAnalysisScore() != null) {
      return toAnalysisResponse(cv);
    }

    enforceDailyAnalysisLimit(user);

    GeminiService.CVInsight insight = geminiService.analyzeCv(cv.getExtractedText());
    cv.setAnalysisScore(insight.score());
    cv.setAnalysisSummary(insight.summary());
    cv.setAnalysisStrengths(writeList(insight.strengths()));
    cv.setAnalysisImprovements(writeList(insight.improvements()));
    cv.setRecommendedQuestions(null);

    CV savedCv = cvRepository.save(cv);
    recordAiUsage(user, AIUsageType.CV_ANALYSIS);
    return toAnalysisResponse(savedCv);
  }

  public CVAnalysisResponse getAnalysis(User user, Long cvId) {
    CV cv = cvRepository.findByIdAndUserId(cvId, user.getId()).orElseThrow(() -> new IllegalArgumentException("CV not found."));

    if (cv.getAnalysisScore() == null) {
      throw new IllegalArgumentException("This CV has not been analyzed yet.");
    }

    return toAnalysisResponse(cv);
  }

  public boolean isGeminiConfigured() {
    return geminiService.isConfigured();
  }

  public AIConfigResponse getConfig(User user) {
    return new AIConfigResponse(
            geminiService.isConfigured(), dailyAnalysisLimit, getRemainingAnalysesToday(user));
  }

  private CVAnalysisResponse toAnalysisResponse(CV cv) {
    return new CVAnalysisResponse(
            cv.getId(), cv.getOriginalFileName(), cv.getAnalysisScore(), cv.getAnalysisSummary(), readList(cv.getAnalysisStrengths()), readList(cv.getAnalysisImprovements()), cv.getUpdatedAt());
  }

  private void validatePdf(MultipartFile file) {
    if (file.isEmpty()) {
      throw new IllegalArgumentException("Please choose a PDF file to upload.");
    }

    String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
    String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    boolean isPdf = fileName.endsWith(".pdf") || "application/pdf".equals(contentType);

    if (!isPdf) {
      throw new IllegalArgumentException("Only PDF CV files are supported right now.");
    }
  }

  private String previewText(String extractedText) {
    String normalized = extractedText.replaceAll("\\s+", " ").trim();
    if (normalized.length() <= 240) {
      return normalized;
    }
    return normalized.substring(0, 240) + "...";
  }

  private String writeList(List<String> items) {
    try {
      return objectMapper.writeValueAsString(items);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to store analysis details.", exception);
    }
  }

  private List<String> readList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }

    try {
      return objectMapper.readValue(value, STRING_LIST);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to read analysis details.", exception);
    }
  }

  private void enforceDailyAnalysisLimit(User user) {
    long remaining = getRemainingAnalysesToday(user);
    if (remaining <= 0) {
      throw new ResponseStatusException(
              HttpStatus.TOO_MANY_REQUESTS, "You have reached the daily AI analysis limit of %d times. Please try again tomorrow.".formatted(dailyAnalysisLimit));
    }
  }

  private long getRemainingAnalysesToday(User user) {
    long usageCount = getTodayUsageCount(user);
    return Math.max(0, dailyAnalysisLimit - usageCount);
  }

  private long getTodayUsageCount(User user) {
    LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
    LocalDateTime endOfDay = startOfDay.plusDays(1);
    return aiUsageLogRepository.countByUserIdAndUsageTypeAndUsedAtBetween(
            user.getId(), AIUsageType.CV_ANALYSIS, startOfDay, endOfDay);
  }

  private void recordAiUsage(User user, AIUsageType usageType) {
    AIUsageLog usageLog = new AIUsageLog();
    usageLog.setUser(user);
    usageLog.setUsageType(usageType);
    aiUsageLogRepository.save(usageLog);
  }
}
