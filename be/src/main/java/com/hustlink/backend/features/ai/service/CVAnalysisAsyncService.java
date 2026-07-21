package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.model.AIUsageType;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.model.CVJobAnalysis;
import com.hustlink.backend.features.ai.model.CVJobAnalysisStatus;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.CVJobAnalysisRepository;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.jobs.model.Job;
import com.hustlink.backend.features.jobs.service.JobMatchingService;
import com.hustlink.backend.features.notifications.service.NotificationService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class CVAnalysisAsyncService {
  private final CVJobAnalysisRepository cvJobAnalysisRepository;
  private final GeminiService geminiService;
  private final JobMatchingService jobMatchingService;
  private final AIUsageLogRepository aiUsageLogRepository;
  private final UserRepository userRepository;
  private final TransactionTemplate transactionTemplate;
  private final ObjectMapper objectMapper;
  private final NotificationService notificationService;

  @Async
  public void runAnalysis(Long analysisId, Long userId) {
    log.info("Starting async CV-JD analysis for analysisId={}, userId={}", analysisId, userId);

    CVJobAnalysis analysis;
    CV cv;
    Job job;
    User user;

    try {
      Object[] loaded = transactionTemplate.execute(status -> {
        CVJobAnalysis a = cvJobAnalysisRepository.findById(analysisId).orElseThrow(() -> new IllegalArgumentException("CVJobAnalysis not found: " + analysisId));

        CV c = a.getCv();
        if (c != null) {
          c.getExtractedText();
        }

        Job j = a.getJob();
        if (j != null) {
          if (j.getCompany() != null) {
            j.getCompany().getName();
          }
          if (j.getSkills() != null) {
            j.getSkills().size();
          }
          j.getRawImportedContent();
        }

        User u = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        return new Object[]{a, c, j, u};
      });

      analysis = (CVJobAnalysis) loaded[0];
      cv = (CV) loaded[1];
      job = (Job) loaded[2];
      user = (User) loaded[3];
    } catch (Exception e) {
      log.error("Failed to load CVJobAnalysis/dependencies for analysisId={}", analysisId, e);
      return;
    }

    String jobContext = jobMatchingService.buildJobContext(job);

    GeminiService.CVInsight insight;
    JobMatchingService.MatchResult matchResult;
    try {
      GeminiService.clearLastTokenUsage();
      insight = geminiService.analyzeCv("""
              Analyze this CV against the target JD. Focus on suitability, gaps, and rewrite suggestions for this exact JD.

              Target JD:
              %s

              Candidate CV:
              %s
              """.formatted(jobContext, cv.getExtractedText()));

      matchResult = jobMatchingService.computeMatch(
              cv, job, insight.skills(), insight.matchReasons(), insight.matchGaps());
    } catch (Exception e) {
      GeminiService.clearLastTokenUsage();
      log.error("Gemini/Matching call failed for analysisId={}", analysisId, e);
      try {
        transactionTemplate.execute(status -> {
          cvJobAnalysisRepository.findById(analysisId).ifPresent(a -> {
            a.setStatus(CVJobAnalysisStatus.FAILED);
            cvJobAnalysisRepository.save(a);
          });
          return null;
        });
      } catch (Exception ex) {
        log.error("Failed to update status to FAILED for analysisId={}", analysisId, ex);
      }
      return;
    }

    try {
      transactionTemplate.execute(status -> {
        CVJobAnalysis a = cvJobAnalysisRepository.findById(analysisId).orElseThrow(() -> new IllegalArgumentException("CVJobAnalysis not found in save step: " + analysisId));
        a.setScore(insight.score());
        a.setSummary(insight.summary());
        a.setStrengths(writeList(insight.strengths()));
        a.setImprovements(writeList(insight.improvements()));
        a.setExtractedSkills(writeList(insight.skills()));
        a.setMatchScore(matchResult.score());
        a.setMatchBreakdown(matchResult.breakdown());
        a.setMatchReasoning(matchResult.reasoning());
        a.setJobSnapshot(jobContext);
        a.setStatus(CVJobAnalysisStatus.COMPLETED);
        cvJobAnalysisRepository.save(a);

        recordAiUsage(user);
        return null;
      });
      try {
        notificationService.sendCvJdAnalysisSuccessNotification(user, cv.getId());
      } catch (Exception ex) {
        log.error("Failed to send success notification for analysisId={}", analysisId, ex);
      }
      log.info("Successfully completed async CV-JD analysis for analysisId={}", analysisId);
    } catch (Exception e) {
      log.error("Failed to save final results for analysisId={}", analysisId, e);
      try {
        transactionTemplate.execute(status -> {
          cvJobAnalysisRepository.findById(analysisId).ifPresent(a -> {
            a.setStatus(CVJobAnalysisStatus.FAILED);
            cvJobAnalysisRepository.save(a);
          });
          return null;
        });
      } catch (Exception ex) {
        log.error("Failed to update status to FAILED for analysisId={}", analysisId, ex);
      }
    }
  }

  private void recordAiUsage(User user) {
    AIUsageLog usageLog = new AIUsageLog();
    usageLog.setUser(user);
    usageLog.setUsageType(AIUsageType.CV_ANALYSIS);
    GeminiService.TokenUsage usage = GeminiService.getLastTokenUsage();
    if (usage != null) {
      usageLog.setPromptTokens(usage.promptTokens());
      usageLog.setCompletionTokens(usage.completionTokens());
      usageLog.setEstimatedCostUsd(usage.estimatedCostUsd());
      GeminiService.clearLastTokenUsage();
    }
    aiUsageLogRepository.save(usageLog);
  }

  private String writeList(List<String> items) {
    try {
      return objectMapper.writeValueAsString(items == null ? List.of() : items);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to store analysis details.", exception);
    }
  }
}
