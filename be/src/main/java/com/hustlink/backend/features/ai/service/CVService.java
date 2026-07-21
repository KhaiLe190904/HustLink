package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.dto.AIConfigResponse;
import com.hustlink.backend.features.ai.dto.CVContextDebugResponse;
import com.hustlink.backend.features.ai.dto.CVJobAnalysisResponse;
import com.hustlink.backend.features.ai.dto.CVSummaryResponse;
import com.hustlink.backend.features.ai.dto.CVUploadResponse;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.model.AIUsageType;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.model.CVJobAnalysis;
import com.hustlink.backend.features.ai.model.CVJobAnalysisStatus;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.CVJobAnalysisRepository;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.ai.repository.InterviewSessionRepository;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.jobs.model.Job;
import com.hustlink.backend.features.jobs.repository.JobRepository;
import com.hustlink.backend.features.jobs.service.JobMatchingService;
import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import com.hustlink.backend.features.storage.service.ObjectStorageService;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
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
  private final CVJobAnalysisRepository cvJobAnalysisRepository;
  private final CVParserService cvParserService;
  private final GeminiService geminiService;
  private final CVContextBuilder cvContextBuilder;
  private final JobRepository jobRepository;
  private final JobMatchingService jobMatchingService;
  private final ObjectStorageService objectStorageService;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;
  private final CVAnalysisAsyncService cvAnalysisAsyncService;

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
            cv.getId(), cv.getFileName(), cv.getOriginalFileName(), cv.getMimeType(), objectStorageService.getAccessUrl(cv.getStoredObject()), cv.getUploadedAt())).toList();
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

  private CVJobAnalysis handleTimeoutAndSave(CVJobAnalysis analysis) {
    if ((analysis.getStatus() == CVJobAnalysisStatus.ANALYZING || analysis.getStatus() == CVJobAnalysisStatus.PENDING) && analysis.getUpdatedAt().plusMinutes(5).isBefore(LocalDateTime.now())) {
      analysis.setStatus(CVJobAnalysisStatus.FAILED);
      return cvJobAnalysisRepository.save(analysis);
    }
    return analysis;
  }

  public CVJobAnalysisResponse getJobAnalysisByCvAndJob(User user, Long cvId, Long jobId) {
    return cvJobAnalysisRepository.findByCvIdAndJobId(cvId, jobId).filter(a -> a.getCv().getUser().getId().equals(user.getId())).map(this::handleTimeoutAndSave).map(this::toJobAnalysisResponse).orElse(null);
  }

  public CVJobAnalysisResponse analyzeCvForJob(User user, Long cvId, Long jobId) {
    CV cv = cvRepository.findByIdAndUserId(cvId, user.getId()).orElseThrow(() -> new IllegalArgumentException("CV not found."));
    Job job = jobRepository.findById(jobId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found."));

    AnalysisStartDecision decision = transactionTemplate.execute(status -> {
      Optional<CVJobAnalysis> existingOpt = cvJobAnalysisRepository.findByCvIdAndJobId(cvId, jobId);

      if (existingOpt.isPresent()) {
        CVJobAnalysis existing = existingOpt.get();
        if (existing.getStatus() == CVJobAnalysisStatus.COMPLETED) {
          return new AnalysisStartDecision(refreshSkillMatchIfNeeded(existing), false);
        } else
          if (existing.getStatus() == CVJobAnalysisStatus.ANALYZING || existing.getStatus() == CVJobAnalysisStatus.PENDING) {
            if (existing.getUpdatedAt().plusMinutes(5).isBefore(LocalDateTime.now())) {
              enforceDailyAnalysisLimit(user);
              existing.setStatus(CVJobAnalysisStatus.ANALYZING);
              existing.setUpdatedAt(LocalDateTime.now());
              return new AnalysisStartDecision(cvJobAnalysisRepository.save(existing), true);
            }
            return new AnalysisStartDecision(existing, false);
          } else { // FAILED
            enforceDailyAnalysisLimit(user);
            existing.setStatus(CVJobAnalysisStatus.ANALYZING);
            existing.setUpdatedAt(LocalDateTime.now());
            return new AnalysisStartDecision(cvJobAnalysisRepository.save(existing), true);
          }
      }

      enforceDailyAnalysisLimit(user);
      CVJobAnalysis analysis = new CVJobAnalysis();
      analysis.setCv(cv);
      analysis.setJob(job);
      analysis.setStatus(CVJobAnalysisStatus.ANALYZING);
      analysis.setScore(0);
      analysis.setMatchScore(0);
      return new AnalysisStartDecision(cvJobAnalysisRepository.save(analysis), true);
    });

    if (decision.startAsync()) {
      cvAnalysisAsyncService.runAnalysis(decision.analysis().getId(), user.getId());
    }

    return toJobAnalysisResponse(decision.analysis());
  }

  private CVJobAnalysis refreshSkillMatchIfNeeded(CVJobAnalysis analysis) {
    List<String> jdAnalysisSkills = readList(analysis.getExtractedSkills());
    if (jdAnalysisSkills.isEmpty() || !hasZeroSkillBreakdown(analysis.getMatchBreakdown())) {
      return analysis;
    }
    JobMatchingService.MatchResult matchResult = jobMatchingService.computeMatch(analysis.getCv(), analysis.getJob(), jdAnalysisSkills);
    analysis.setMatchScore(matchResult.score());
    analysis.setMatchBreakdown(matchResult.breakdown());
    analysis.setMatchReasoning(matchResult.reasoning());
    return cvJobAnalysisRepository.save(analysis);
  }

  private boolean hasZeroSkillBreakdown(String breakdownJson) {
    if (breakdownJson == null || breakdownJson.isBlank()) {
      return false;
    }
    try {
      return objectMapper.readTree(breakdownJson).path("skills").asInt(-1) == 0;
    } catch (JsonProcessingException exception) {
      return false;
    }
  }

  public CVJobAnalysisResponse getJobAnalysis(User user, Long analysisId) {
    CVJobAnalysis analysis = cvJobAnalysisRepository.findByIdAndCvUserId(analysisId, user.getId()).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV-JD analysis not found."));
    return toJobAnalysisResponse(handleTimeoutAndSave(analysis));
  }

  public List<CVJobAnalysisResponse> getJobAnalyses(User user, Long cvId) {
    List<CVJobAnalysis> analyses = cvId == null ? cvJobAnalysisRepository.findByCvUserIdOrderByUpdatedAtDesc(user.getId()) : cvJobAnalysisRepository.findByCvIdAndCvUserIdOrderByUpdatedAtDesc(cvId, user.getId());
    return analyses.stream().filter(analysis -> analysis.getStatus() == CVJobAnalysisStatus.COMPLETED).map(this::toJobAnalysisResponse).toList();
  }

  public CVContextDebugResponse debugContext(User user, Long cvId, String jobPosition, String level) {
    CV cv = cvRepository.findByIdAndUserId(cvId, user.getId()).orElseThrow(() -> new IllegalArgumentException("CV not found."));
    return cvContextBuilder.debug(cv, normalizeJobPosition(jobPosition, user.getPosition()), InterviewLevel.fromValue(level));
  }

  public CVContextDebugResponse debugUploadedContext(User user, MultipartFile file, String jobPosition, String level) {
    validatePdf(file);
    String extractedText;
    try {
      extractedText = cvParserService.extractTextFromPdf(file);
    } catch (IOException exception) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "The uploaded file is not a valid readable PDF.", exception);
    }
    CV cv = new CV();
    cv.setUser(user);
    cv.setOriginalFileName(file.getOriginalFilename() == null ? "cv.pdf" : file.getOriginalFilename());
    cv.setExtractedText(extractedText);
    return cvContextBuilder.debug(cv, normalizeJobPosition(jobPosition, user.getPosition()), InterviewLevel.fromValue(level));
  }

  public boolean isGeminiConfigured() {
    return geminiService.isConfigured();
  }

  private String normalizeJobPosition(String requested, String fallback) {
    if (requested != null && !requested.isBlank()) {
      return requested.trim();
    }
    if (fallback != null && !fallback.isBlank()) {
      return fallback.trim();
    }
    return "Software Engineer";
  }

  public AIConfigResponse getConfig(User user) {
    return new AIConfigResponse(
            geminiService.isConfigured(), dailyAnalysisLimit, getRemainingAnalysesToday(user));
  }

  private CVJobAnalysisResponse toJobAnalysisResponse(CVJobAnalysis analysis) {
    return CVJobAnalysisResponse.fromEntity(
            analysis, readList(analysis.getStrengths()), readList(analysis.getImprovements()), readList(analysis.getExtractedSkills()));
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
    GeminiService.TokenUsage usage = GeminiService.getLastTokenUsage();
    if (usage != null) {
      usageLog.setPromptTokens(usage.promptTokens());
      usageLog.setCompletionTokens(usage.completionTokens());
      usageLog.setEstimatedCostUsd(usage.estimatedCostUsd());
      GeminiService.clearLastTokenUsage();
    }
    aiUsageLogRepository.save(usageLog);
  }

  private record AnalysisStartDecision(CVJobAnalysis analysis, boolean startAsync) {
  }
}
