package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.dto.*;
import com.hustlink.backend.features.ai.model.*;
import com.hustlink.backend.features.ai.rag.dto.RagQuestionContext;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.ai.repository.InterviewAnswerRepository;
import com.hustlink.backend.features.ai.repository.InterviewQuestionRepository;
import com.hustlink.backend.features.ai.repository.InterviewSessionRepository;
import com.hustlink.backend.features.ai.repository.InterviewQuestionBankRepository;
import com.hustlink.backend.features.ai.rag.RagInterviewService;
import com.hustlink.backend.features.ai.util.LanguageUtils;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIInterviewService {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };
  private static final Set<String> COVERAGE_STOP_WORDS = Set.of(
          "a", "an", "and", "are", "as", "at", "be", "brief", "by", "clear", "common", "components", "constraints", "core", "def", "definition", "details", "do", "edge", "example", "for", "from", "how", "if", "impact", "in", "into", "is", "it", "its", "key", "need", "of", "on", "or", "practical", "purpose", "relevant", "role", "should", "simple", "than", "that", "the", "their", "them", "there", "these", "this", "to", "use", "what", "when", "which", "why", "with", "without", "your");

  private final AIUsageLogRepository aiUsageLogRepository;
  private final InterviewSessionRepository interviewSessionRepository;
  private final InterviewQuestionRepository interviewQuestionRepository;
  private final InterviewAnswerRepository interviewAnswerRepository;
  private final InterviewQuestionBankRepository interviewQuestionBankRepository;
  private final CVRepository cvRepository;
  private final UserRepository userRepository;
  private final GeminiService geminiService;
  private final RagInterviewService ragInterviewService;
  private final CVContextBuilder cvContextBuilder;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;

  @Value("${ai.interview.question-count:5}")
  private int questionCount;

  @Value("${ai.interview.answer-time-limit-seconds:300}")
  private int answerTimeLimitSeconds;

  @Value("${ai.daily-mock-interview-limit:2}")
  private int dailyMockInterviewLimit;

  @Value("${app.features.rag.enabled:true}")
  private boolean ragEnabled;

  public InterviewStartResponse startInterview(User user, InterviewStartRequest request) {
    if (!geminiService.isConfigured()) {
      throw new ResponseStatusException(
              HttpStatus.SERVICE_UNAVAILABLE, "Gemini API key is not configured.");
    }

    if (request.cvId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select a CV.");
    }

    Optional<InterviewSession> latestSessionOpt = interviewSessionRepository.findFirstByUserIdOrderByStartedAtDesc(user.getId());
    if (latestSessionOpt.isPresent()) {
      InterviewSession latestSession = latestSessionOpt.get();
      if (latestSession.getStatus() == InterviewSessionStatus.CREATING && latestSession.getStartedAt().plusMinutes(5).isAfter(LocalDateTime.now())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "An interview session is currently being created. Please wait a moment.");
      }
      if (latestSession.getStatus() == InterviewSessionStatus.IN_PROGRESS && latestSession.getStartedAt().plusMinutes(15).isAfter(LocalDateTime.now())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You have an active interview session in progress. Please resume it.");
      }
    }

    enforceDailyMockInterviewLimit(user);

    CV cv = cvRepository.findByIdAndUserId(request.cvId(), user.getId()).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV not found."));

    String jobPosition = normalizeJobPosition(request.jobPosition(), user.getPosition(), "Software Engineer");
    List<String> requestedStacks = request.stacks() == null ? List.of() : request.stacks();
    InterviewLevel interviewLevel = request.level() == null || request.level().isBlank() ? InterviewLevel.inferFromText(jobPosition) : InterviewLevel.fromValue(request.level());

    InterviewSession sessionPlaceholder = transactionTemplate.execute(status -> {
      userRepository.findByIdForUpdate(user.getId()).orElseThrow(
              () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
      Optional<InterviewSession> raceCheckSession = interviewSessionRepository.findFirstByUserIdOrderByStartedAtDesc(user.getId());
      if (raceCheckSession.isPresent()) {
        InterviewSession raceSession = raceCheckSession.get();
        if (raceSession.getStatus() == InterviewSessionStatus.CREATING && raceSession.getStartedAt().plusMinutes(5).isAfter(LocalDateTime.now())) {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "An interview session is currently being created. Please wait a moment.");
        }
        if (raceSession.getStatus() == InterviewSessionStatus.IN_PROGRESS && raceSession.getStartedAt().plusMinutes(15).isAfter(LocalDateTime.now())) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You have an active interview session in progress. Please resume it.");
        }
      }

      InterviewSession session = new InterviewSession();
      session.setUser(user);
      session.setCv(cv);
      session.setJobPosition(jobPosition);
      session.setInterviewLevel(interviewLevel);
      session.setLanguageCode("UNKNOWN");
      session.setStatus(InterviewSessionStatus.CREATING);
      session.setTotalQuestions(questionCount);
      session.setCurrentQuestionIndex(0);
      session.setAnswerTimeLimitSeconds(answerTimeLimitSeconds);
      return interviewSessionRepository.save(session);
    });

    List<GeminiService.InterviewQuestionDraft> drafts;
    String languageCode;
    List<RagQuestionContext> questionContexts;
    try {
      languageCode = geminiService.resolveInterviewLanguageCode(cv.getExtractedText());
      questionContexts = ragEnabled ? ragInterviewService.retrieveRelevantQuestionContexts(
              cvContextBuilder.buildRetrievalQuery(cv, jobPosition, interviewLevel), jobPosition, requestedStacks, interviewLevel, languageCode, Math.max(12, questionCount)) : List.of();

      List<String> ragContext = questionContexts.stream().map(this::formatRagContext).toList();

      drafts = geminiService.generateInterviewQuestions(
              cvContextBuilder.buildGenerationContext(cv, interviewLevel), jobPosition, interviewLevel.name(), questionCount, ragContext);

      if (drafts.isEmpty()) {
        throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate interview questions.");
      }
    } catch (Exception e) {
      transactionTemplate.execute(status -> {
        interviewSessionRepository.delete(sessionPlaceholder);
        return null;
      });
      throw e;
    }

    List<GeminiService.InterviewQuestionDraft> selectedDrafts = drafts.stream().limit(questionCount).toList();
    List<String> ragContext = questionContexts.stream().map(this::formatRagContext).toList();
    RagDebugResponse questionRagDebug = buildRagDebug("question_generation", questionContexts, languageCode);

    InterviewSession savedSession = transactionTemplate.execute(status -> {
      InterviewSession session = interviewSessionRepository.findById(sessionPlaceholder.getId()).orElseThrow();
      session.setLanguageCode(languageCode);
      session.setStatus(InterviewSessionStatus.IN_PROGRESS);
      session.setTotalQuestions(selectedDrafts.size());

      List<InterviewQuestion> questions = selectedDrafts.stream().map(
              draft -> {
                InterviewQuestion question = new InterviewQuestion();
                question.setSession(session);
                question.setQuestionOrder(draft.questionOrder());
                question.setCategory(InterviewQuestionCategory.fromValue(draft.category()));
                question.setQuestionText(draft.text());
                question.setExpectedPoints(writeList(draft.expectedPoints()));
                return question;
              }).toList();
      interviewQuestionRepository.saveAll(questions);

      recordInterviewUsage(user);
      if (!ragContext.isEmpty()) {
        recordAiUsage(user, AIUsageType.RAG_RETRIEVE);
      }
      return interviewSessionRepository.save(session);
    });

    List<InterviewQuestion> savedQuestions = interviewQuestionRepository.findBySessionIdOrderByQuestionOrderAsc(savedSession.getId());
    InterviewQuestion firstQuestion = savedQuestions.stream().min(Comparator.comparingInt(InterviewQuestion::getQuestionOrder)).orElseThrow();

    return new InterviewStartResponse(
            savedSession.getId(), cv.getId(), cv.getOriginalFileName(), savedSession.getJobPosition(), savedSession.getInterviewLevel().name(), savedSession.getLanguageCode(), savedSession.getTotalQuestions(), savedSession.getAnswerTimeLimitSeconds(), toQuestionResponse(firstQuestion, savedSession), questionRagDebug);
  }

  public InterviewSubmitAnswerResponse submitAnswer(
                                                    User user, Long sessionId, InterviewAnswerRequest request) {
    InterviewSession session = interviewSessionRepository.findByIdAndUserId(sessionId, user.getId()).orElseThrow(
            () -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Interview session not found."));

    if (session.getStatus() != InterviewSessionStatus.IN_PROGRESS) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "This interview session is already completed.");
    }

    if (request.questionId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question is required.");
    }

    InterviewQuestion question = interviewQuestionRepository.findByIdAndSessionId(request.questionId(), sessionId).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found."));

    if (session.getCurrentQuestionIndex() >= session.getTotalQuestions() && question.getQuestionOrder() == session.getTotalQuestions()) {
      InterviewResultResponse results = completeInterview(session);
      return new InterviewSubmitAnswerResponse(
              session.getId(), true, session.getCurrentQuestionIndex(), session.getTotalQuestions(), null, results);
    }

    int expectedQuestionOrder = session.getCurrentQuestionIndex() + 1;
    if (question.getQuestionOrder() != expectedQuestionOrder) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "Please answer the current question in order.");
    }

    transactionTemplate.execute(status -> {
      InterviewAnswer answer = interviewAnswerRepository.findByQuestionId(question.getId()).orElseGet(InterviewAnswer::new);
      answer.setSession(session);
      answer.setQuestion(question);
      answer.setAnswerText(normalizeAnswerText(request.answerText()));
      answer.setDurationSeconds(clampDuration(request.durationSeconds(), session.getAnswerTimeLimitSeconds()));
      interviewAnswerRepository.save(answer);

      session.setCurrentQuestionIndex(question.getQuestionOrder());
      interviewSessionRepository.save(session);
      return null;
    });

    if (question.getQuestionOrder() >= session.getTotalQuestions()) {
      InterviewResultResponse results = completeInterview(session);
      return new InterviewSubmitAnswerResponse(
              session.getId(), true, session.getCurrentQuestionIndex(), session.getTotalQuestions(), null, results);
    }

    InterviewQuestion nextQuestion = interviewQuestionRepository.findBySessionIdAndQuestionOrder(session.getId(), question.getQuestionOrder() + 1).orElseThrow(
            () -> new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Next question not found."));

    return new InterviewSubmitAnswerResponse(
            session.getId(), false, session.getCurrentQuestionIndex(), session.getTotalQuestions(), toQuestionResponse(nextQuestion, session), null);
  }

  @Transactional(readOnly = true)
  public InterviewResultResponse getResults(User user, Long sessionId) {
    InterviewSession session = interviewSessionRepository.findByIdAndUserId(sessionId, user.getId()).orElseThrow(
            () -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Interview session not found."));

    if (session.getStatus() != InterviewSessionStatus.COMPLETED) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "Interview results are not ready yet.");
    }

    return toInterviewResults(session, null);
  }

  @Transactional(readOnly = true)
  public Page<InterviewSessionSummaryResponse> getHistory(User user, Pageable pageable) {
    List<InterviewSessionStatus> statuses = List.of(InterviewSessionStatus.IN_PROGRESS, InterviewSessionStatus.COMPLETED);
    return interviewSessionRepository.findByUserIdAndStatusInOrderByStartedAtDesc(user.getId(), statuses, pageable).map(
            session -> new InterviewSessionSummaryResponse(
                    session.getId(), session.getCv().getId(), session.getCv().getOriginalFileName(), session.getJobPosition(), session.getLanguageCode(), session.getStatus().name(), session.getTotalQuestions(), session.getCurrentQuestionIndex(), session.getOverallScore(), session.getStartedAt(), session.getCompletedAt()));
  }

  @Transactional(readOnly = true)
  public InterviewStartResponse getActiveSession(User user) {
    Optional<InterviewSession> latestSessionOpt = interviewSessionRepository.findFirstByUserIdOrderByStartedAtDesc(user.getId());
    if (latestSessionOpt.isEmpty()) {
      return null;
    }
    InterviewSession session = latestSessionOpt.get();
    if (session.getStatus() != InterviewSessionStatus.IN_PROGRESS || session.getStartedAt().plusMinutes(15).isBefore(LocalDateTime.now())) {
      return null;
    }

    int currentOrder = session.getCurrentQuestionIndex() + 1;
    InterviewQuestion currentQuestion = interviewQuestionRepository.findBySessionIdAndQuestionOrder(session.getId(), currentOrder).orElse(null);

    if (currentQuestion == null) {
      return null;
    }

    return new InterviewStartResponse(
            session.getId(), session.getCv().getId(), session.getCv().getOriginalFileName(), session.getJobPosition(), session.getInterviewLevel().name(), session.getLanguageCode(), session.getTotalQuestions(), session.getAnswerTimeLimitSeconds(), toQuestionResponse(currentQuestion, session), null
    );
  }

  // completeInterview: gọi Gemini TRƯỚC (ngoài transaction), rồi ghi kết quả
  // vào DB trong một transaction ngắn riêng.
  private InterviewResultResponse completeInterview(InterviewSession session) {
    // --- BƯỚC 1: Đọc dữ liệu câu hỏi/trả lời (không cần transaction dài) ---
    List<InterviewQuestion> questions = interviewQuestionRepository.findBySessionIdOrderByQuestionOrderAsc(session.getId());
    List<InterviewAnswer> answers = interviewAnswerRepository.findBySessionIdOrderByQuestionQuestionOrderAsc(session.getId());

    if (answers.size() != questions.size()) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "All interview questions must be answered before finishing.");
    }

    List<GeminiService.InterviewQuestionAnswerDraft> questionAnswers = questions.stream().map(
            question -> {
              InterviewAnswer answer = answers.stream().filter(item -> item.getQuestion().getId().equals(question.getId())).findFirst().orElseThrow();
              return new GeminiService.InterviewQuestionAnswerDraft(
                      question.getQuestionOrder(), question.getQuestionText(), question.getCategory().name(), readList(question.getExpectedPoints()), answer.getAnswerText());
            }).toList();

    // --- BƯỚC 2: Gọi RAG + Gemini để đánh giá (NGOÀI transaction DB) ---
    List<RagQuestionContext> evaluationContexts = ragEnabled ? ragInterviewService.retrieveRelevantQuestionContexts(
            buildEvaluationQuery(session, questionAnswers), session.getJobPosition(), List.of(), session.getInterviewLevel(), session.getLanguageCode(), 10) : List.of();
    List<String> evaluationRagContext = evaluationContexts.stream().map(this::formatRagContext).toList();
    RagDebugResponse evaluationRagDebug = buildRagDebug("evaluation", evaluationContexts, session.getLanguageCode());

    GeminiService.InterviewEvaluation evaluation = geminiService.evaluateInterview(
            session.getCv().getExtractedText(), session.getJobPosition(), session.getInterviewLevel().name(), questionAnswers, evaluationRagContext);

    // --- BƯỚC 3: Tính điểm (logic thuần túy, không cần DB) ---
    for (InterviewAnswer answer : answers) {
      evaluation.answerReviews().stream().filter(review -> review.questionOrder() == answer.getQuestion().getQuestionOrder()).findFirst().ifPresent(
              review -> {
                int calibratedScore = calibrateAnswerScore(
                        review.score(), session.getInterviewLevel(), readList(answer.getQuestion().getExpectedPoints()), answer.getAnswerText());
                answer.setScore(calibratedScore);
                answer.setFeedback(review.feedback());
                answer.setStrengths(writeList(review.strengths()));
                answer.setImprovements(writeList(review.improvements()));
              });
    }

    int calibratedOverallScore = blendOverallScore(
            evaluation.overallScore(), answers.stream().map(InterviewAnswer::getScore).filter(score -> score != null).toList());

    // --- BƯỚC 4: Ghi kết quả vào DB trong transaction CỰC NGẮN ---
    transactionTemplate.execute(status -> {
      interviewAnswerRepository.saveAll(answers);
      session.setStatus(InterviewSessionStatus.COMPLETED);
      session.setCompletedAt(java.time.LocalDateTime.now());
      session.setOverallScore(calibratedOverallScore);
      session.setOverallSummary(evaluation.summary());
      session.setOverallStrengths(writeList(evaluation.strengths()));
      session.setOverallImprovements(writeList(evaluation.improvements()));
      interviewSessionRepository.save(session);
      return null;
    });

    // --- BƯỚC 5: Tự động lưu và index câu hỏi mới vào Question Bank ---
    try {
      saveAndIndexNewQuestionsToBank(questions, session);
    } catch (Exception ex) {
      log.error("Failed to automatically save generated questions to bank for session: {}", session.getId(), ex);
    }

    return toInterviewResults(session, evaluationRagDebug);
  }

  private void saveAndIndexNewQuestionsToBank(List<InterviewQuestion> questions, InterviewSession session) {
    for (InterviewQuestion question : questions) {
      String normalizedQuestionText = question.getQuestionText().trim();
      String normalizedPosition = session.getJobPosition().trim();
      boolean exists = interviewQuestionBankRepository.existsByQuestionTextAndTargetPositionAndLevel(
              normalizedQuestionText, normalizedPosition, session.getInterviewLevel());
      if (!exists) {
        // Lưu DB trong transaction ngắn riêng biệt
        InterviewQuestionBank bankQuestion = transactionTemplate.execute(status -> {
          // Double check in transaction
          boolean existsInTx = interviewQuestionBankRepository.existsByQuestionTextAndTargetPositionAndLevel(
                  normalizedQuestionText, normalizedPosition, session.getInterviewLevel());
          if (existsInTx) {
            return null;
          }
          InterviewQuestionBank entity = new InterviewQuestionBank();
          entity.setQuestionText(normalizedQuestionText);
          entity.setTargetPosition(normalizedPosition);
          entity.setLevel(session.getInterviewLevel());
          entity.setCategory(question.getCategory() == null ? InterviewQuestionCategory.GENERAL : question.getCategory());
          entity.setDifficulty(session.getInterviewLevel().name());
          entity.setExpectedPoints(question.getExpectedPoints());
          entity.setSource("AI_GENERATED_SESSION_" + session.getId());
          entity.setLanguageCode(LanguageUtils.normalize(session.getLanguageCode()));
          return interviewQuestionBankRepository.save(entity);
        });

        // Index lên Qdrant ngoài transaction vì có thực hiện gọi Gemini Embedding API (chậm/mạng)
        if (bankQuestion != null) {
          try {
            ragInterviewService.indexQuestion(bankQuestion);
            transactionTemplate.execute(status -> {
              interviewQuestionBankRepository.save(bankQuestion);
              return null;
            });
            log.info("op=auto_save_bank status=success questionId={} vectorId={}", bankQuestion.getId(), bankQuestion.getVectorId());
          } catch (Exception e) {
            log.error("op=auto_save_bank status=fail_indexing questionId={} error={}", bankQuestion.getId(), e.getMessage(), e);
          }
        }
      }
    }
  }

  private InterviewResultResponse toInterviewResults(InterviewSession session, RagDebugResponse ragDebug) {
    List<InterviewAnswerReviewResponse> reviews = interviewAnswerRepository.findBySessionIdOrderByQuestionQuestionOrderAsc(session.getId()).stream().map(
            answer -> new InterviewAnswerReviewResponse(
                    answer.getQuestion().getId(), answer.getQuestion().getQuestionOrder(), answer.getQuestion().getCategory().name(), answer.getQuestion().getQuestionText(), answer.getAnswerText(), answer.getDurationSeconds(), answer.getScore(), answer.getFeedback(), readList(answer.getStrengths()), readList(answer.getImprovements()))).toList();

    return new InterviewResultResponse(
            session.getId(), session.getCv().getId(), session.getCv().getOriginalFileName(), session.getJobPosition(), session.getInterviewLevel().name(), session.getLanguageCode(), session.getOverallScore(), session.getOverallSummary(), readList(session.getOverallStrengths()), readList(session.getOverallImprovements()), reviews, session.getCompletedAt(), ragDebug);
  }

  private InterviewQuestionResponse toQuestionResponse(
                                                       InterviewQuestion question, InterviewSession session) {
    return new InterviewQuestionResponse(
            question.getId(), question.getQuestionOrder(), session.getTotalQuestions(), question.getCategory().name(), question.getQuestionText(), session.getAnswerTimeLimitSeconds());
  }

  private int clampDuration(Integer durationSeconds, Integer maxDurationSeconds) {
    if (durationSeconds == null) {
      return 0;
    }
    return Math.max(0, Math.min(durationSeconds, maxDurationSeconds == null ? 300 : maxDurationSeconds));
  }

  private String normalizeAnswerText(String answerText) {
    return answerText == null ? "" : answerText.trim();
  }

  private String normalizeJobPosition(String requested, String fallback, String defaultValue) {
    if (requested != null && !requested.isBlank()) {
      return requested.trim();
    }
    if (fallback != null && !fallback.isBlank()) {
      return fallback.trim();
    }
    return defaultValue;
  }

  private String trimToMaxChars(String text, int maxChars) {
    if (text == null) {
      return "";
    }
    if (text.length() <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars);
  }

  private String buildEvaluationQuery(
                                      InterviewSession session, List<GeminiService.InterviewQuestionAnswerDraft> questionAnswers) {
    String transcriptSnippet = questionAnswers.stream().map(item -> item.questionText() + " | " + trimToMaxChars(item.answerText(), 300)).reduce("", (left, right) -> left.isBlank() ? right : left + "\n" + right);
    return "Position: %s\nLevel: %s\nTranscript:\n%s".formatted(
            session.getJobPosition(), session.getInterviewLevel().name(), trimToMaxChars(transcriptSnippet, 2500));
  }

  private void enforceDailyMockInterviewLimit(User user) {
    long usageCount = getTodayMockInterviewUsageCount(user);
    if (usageCount >= dailyMockInterviewLimit) {
      throw new ResponseStatusException(
              HttpStatus.TOO_MANY_REQUESTS, "You can only start %d mock interview time(s) per day. Please try again tomorrow.".formatted(dailyMockInterviewLimit));
    }
  }

  private long getTodayMockInterviewUsageCount(User user) {
    LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
    LocalDateTime endOfDay = startOfDay.plusDays(1);
    return aiUsageLogRepository.countByUserIdAndUsageTypeAndUsedAtBetween(
            user.getId(), AIUsageType.MOCK_INTERVIEW, startOfDay, endOfDay);
  }

  private void recordInterviewUsage(User user) {
    recordAiUsage(user, AIUsageType.MOCK_INTERVIEW);
  }

  private void recordAiUsage(User user, AIUsageType usageType) {
    AIUsageLog usageLog = new AIUsageLog();
    usageLog.setUser(user);
    usageLog.setUsageType(usageType);
    com.hustlink.backend.features.ai.service.GeminiService.TokenUsage usage = com.hustlink.backend.features.ai.service.GeminiService.getLastTokenUsage();
    if (usage != null) {
      usageLog.setPromptTokens(usage.promptTokens());
      usageLog.setCompletionTokens(usage.completionTokens());
      usageLog.setEstimatedCostUsd(usage.estimatedCostUsd());
      com.hustlink.backend.features.ai.service.GeminiService.clearLastTokenUsage();
    }
    aiUsageLogRepository.save(usageLog);
  }

  private int calibrateAnswerScore(
                                   int llmScore, InterviewLevel level, List<String> expectedPoints, String answerText) {
    int score = llmScore + levelScoreOffset(level);
    score += expectedCoverageBonus(expectedPoints, answerText, level);
    score += answerLengthAdjustment(answerText, level);
    return Math.max(0, Math.min(100, score));
  }

  private int levelScoreOffset(InterviewLevel level) {
    if (level == null) {
      return 0;
    }
    return switch (level) {
      case INTERN -> 8;
      case FRESHER -> 4;
      case JUNIOR -> 0;
      case SENIOR -> -6;
    };
  }

  private int expectedCoverageBonus(List<String> expectedPoints, String answerText, InterviewLevel level) {
    if (expectedPoints == null || expectedPoints.isEmpty() || answerText == null || answerText.isBlank()) {
      return level == InterviewLevel.INTERN ? -3 : -6;
    }

    String normalizedAnswer = normalizeForMatch(answerText);
    Set<String> answerTokens = tokenizeForCoverage(normalizedAnswer);
    double totalCoverage = 0d;
    for (String point : expectedPoints) {
      totalCoverage += scoreExpectedPointCoverage(point, normalizedAnswer, answerTokens);
    }

    double coverageRatio = totalCoverage / (double) expectedPoints.size();
    if (coverageRatio >= 0.8) {
      return 5;
    }
    if (coverageRatio >= 0.5) {
      return level == InterviewLevel.INTERN ? 3 : 1;
    }
    if (coverageRatio >= 0.3) {
      return level == InterviewLevel.INTERN ? 0 : -2;
    }
    return level == InterviewLevel.INTERN ? -4 : -7;
  }

  private int answerLengthAdjustment(String answerText, InterviewLevel level) {
    if (answerText == null || answerText.isBlank()) {
      return level == InterviewLevel.INTERN ? -5 : -8;
    }
    int wordCount = answerText.trim().split("\\s+").length;
    if (wordCount < 12) {
      return level == InterviewLevel.INTERN ? -2 : -5;
    }
    if (wordCount < 20) {
      return level == InterviewLevel.INTERN ? 0 : -3;
    }
    if (wordCount < 40) {
      return level == InterviewLevel.INTERN ? 1 : -2;
    }
    if (wordCount > 260) {
      return -2;
    }
    return 1;
  }

  private int blendOverallScore(int llmOverallScore, List<Integer> calibratedAnswerScores) {
    if (calibratedAnswerScores == null || calibratedAnswerScores.isEmpty()) {
      return llmOverallScore;
    }

    double average = calibratedAnswerScores.stream().mapToInt(Integer::intValue).average().orElse(llmOverallScore);
    int blended = (int) Math.round(llmOverallScore * 0.35 + average * 0.65);
    return Math.max(0, Math.min(100, blended));
  }

  private String normalizeForMatch(String text) {
    return text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").replaceAll("\\s+", " ").trim();
  }

  private double scoreExpectedPointCoverage(String point, String normalizedAnswer, Set<String> answerTokens) {
    if (point == null || point.isBlank()) {
      return 0d;
    }
    String normalized = normalizeForMatch(point);
    if (normalized.isBlank()) {
      return 0d;
    }

    if (normalizedAnswer.contains(normalized)) {
      return 1d;
    }

    Set<String> pointTokens = tokenizeForCoverage(normalized);
    if (pointTokens.isEmpty()) {
      pointTokens = tokenizeWithoutFiltering(normalized);
    }
    if (pointTokens.isEmpty()) {
      return 0d;
    }

    int overlap = 0;
    for (String token : pointTokens) {
      if (answerTokens.contains(token)) {
        overlap++;
      }
    }

    double ratio = (double) overlap / (double) pointTokens.size();
    if (pointTokens.size() == 1 && overlap == 1) {
      return 0.75d;
    }
    if (pointTokens.size() == 2 && overlap == 2) {
      return 0.9d;
    }
    return ratio;
  }

  private Set<String> tokenizeForCoverage(String text) {
    Set<String> rawTokens = tokenizeWithoutFiltering(text);
    Set<String> filtered = new LinkedHashSet<>();
    for (String token : rawTokens) {
      if (!COVERAGE_STOP_WORDS.contains(token)) {
        filtered.add(token);
      }
    }
    return filtered;
  }

  private Set<String> tokenizeWithoutFiltering(String text) {
    if (text == null || text.isBlank()) {
      return Set.of();
    }
    Set<String> tokens = new LinkedHashSet<>();
    for (String token : text.split("\\s+")) {
      if (!token.isBlank()) {
        tokens.add(token);
      }
    }
    return tokens;
  }

  private RagDebugResponse buildRagDebug(String phase, List<RagQuestionContext> contexts, String languageCode) {
    if (contexts == null || contexts.isEmpty()) {
      return new RagDebugResponse(phase, 0, 0, 0, List.of());
    }

    String normalizedLanguage = LanguageUtils.normalize(languageCode);
    int sameLanguageCount = (int) contexts.stream().filter(context -> LanguageUtils.normalize(context.languageCode()).equals(normalizedLanguage)).count();
    int totalRetrieved = contexts.size();
    int crossLanguageFallbackCount = totalRetrieved - sameLanguageCount;
    List<String> references = contexts.stream().limit(5).map(context -> "[%s|%s|%s] %s".formatted(
            context.targetPosition(), context.level(), context.languageCode(), trimToMaxChars(context.questionText(), 180))).collect(Collectors.toList());
    return new RagDebugResponse(phase, totalRetrieved, sameLanguageCount, crossLanguageFallbackCount, references);
  }

  private String formatRagContext(RagQuestionContext context) {
    String points = context.expectedPoints().isEmpty() ? "" : " | Expected points: " + String.join("; ", context.expectedPoints());
    return "[%s %s] %s%s".formatted(
            context.targetPosition(), context.level(), context.questionText(), points);
  }


  private String writeList(List<String> items) {
    try {
      return objectMapper.writeValueAsString(items == null ? List.of() : items);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to store interview details.", exception);
    }
  }

  private List<String> readList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }

    try {
      return objectMapper.readValue(value, STRING_LIST);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to read interview details.", exception);
    }
  }
}
