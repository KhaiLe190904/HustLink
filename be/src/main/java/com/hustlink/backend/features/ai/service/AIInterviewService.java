package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.dto.*;
import com.hustlink.backend.features.ai.model.*;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.ai.repository.InterviewAnswerRepository;
import com.hustlink.backend.features.ai.repository.InterviewQuestionRepository;
import com.hustlink.backend.features.ai.repository.InterviewSessionRepository;
import com.hustlink.backend.features.authentication.model.User;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AIInterviewService {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };

  private final AIUsageLogRepository aiUsageLogRepository;
  private final InterviewSessionRepository interviewSessionRepository;
  private final InterviewQuestionRepository interviewQuestionRepository;
  private final InterviewAnswerRepository interviewAnswerRepository;
  private final CVRepository cvRepository;
  private final GeminiService geminiService;
  private final ObjectMapper objectMapper;

  @Value("${ai.interview.question-count:5}")
  private int questionCount;

  @Value("${ai.interview.answer-time-limit-seconds:120}")
  private int answerTimeLimitSeconds;

  @Value("${ai.daily-mock-interview-limit:1}")
  private int dailyMockInterviewLimit;

  @Transactional
  public InterviewStartResponse startInterview(User user, InterviewStartRequest request) {
    if (!geminiService.isConfigured()) {
      throw new ResponseStatusException(
              HttpStatus.SERVICE_UNAVAILABLE, "Gemini API key is not configured.");
    }

    if (request.cvId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select a CV.");
    }

    enforceDailyMockInterviewLimit(user);

    CV cv = cvRepository.findByIdAndUserId(request.cvId(), user.getId()).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV not found."));

    String jobPosition = normalizeJobPosition(request.jobPosition(), user.getPosition(), "Software Engineer");

    List<GeminiService.InterviewQuestionDraft> drafts = geminiService.generateInterviewQuestions(cv.getExtractedText(), jobPosition, questionCount);

    if (drafts.isEmpty()) {
      throw new ResponseStatusException(
              HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate interview questions.");
    }

    InterviewSession session = new InterviewSession();
    session.setUser(user);
    session.setCv(cv);
    session.setJobPosition(jobPosition);
    session.setLanguageCode(geminiService.resolveInterviewLanguageCode(cv.getExtractedText()));
    session.setStatus(InterviewSessionStatus.IN_PROGRESS);
    session.setTotalQuestions(drafts.size());
    session.setCurrentQuestionIndex(0);
    session.setAnswerTimeLimitSeconds(answerTimeLimitSeconds);

    InterviewSession savedSession = interviewSessionRepository.save(session);

    List<InterviewQuestion> questions = drafts.stream().limit(questionCount).map(
            draft -> {
              InterviewQuestion question = new InterviewQuestion();
              question.setSession(savedSession);
              question.setQuestionOrder(draft.questionOrder());
              question.setCategory(InterviewQuestionCategory.fromValue(draft.category()));
              question.setQuestionText(draft.text());
              question.setExpectedPoints(writeList(draft.expectedPoints()));
              return question;
            }).toList();

    interviewQuestionRepository.saveAll(questions);
    recordInterviewUsage(user);
    InterviewQuestion firstQuestion = questions.stream().min(Comparator.comparingInt(InterviewQuestion::getQuestionOrder)).orElseThrow();

    return new InterviewStartResponse(
            savedSession.getId(), cv.getId(), cv.getOriginalFileName(), savedSession.getJobPosition(), savedSession.getLanguageCode(), savedSession.getTotalQuestions(), savedSession.getAnswerTimeLimitSeconds(), toQuestionResponse(firstQuestion, savedSession));
  }

  @Transactional
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

    int expectedQuestionOrder = session.getCurrentQuestionIndex() + 1;
    if (question.getQuestionOrder() != expectedQuestionOrder) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "Please answer the current question in order.");
    }

    InterviewAnswer answer = interviewAnswerRepository.findByQuestionId(question.getId()).orElseGet(InterviewAnswer::new);
    answer.setSession(session);
    answer.setQuestion(question);
    answer.setAnswerText(normalizeAnswerText(request.answerText()));
    answer.setDurationSeconds(clampDuration(request.durationSeconds(), session.getAnswerTimeLimitSeconds()));
    interviewAnswerRepository.save(answer);

    session.setCurrentQuestionIndex(question.getQuestionOrder());

    if (question.getQuestionOrder() >= session.getTotalQuestions()) {
      InterviewResultResponse results = completeInterview(session);
      return new InterviewSubmitAnswerResponse(
              session.getId(), true, session.getCurrentQuestionIndex(), session.getTotalQuestions(), null, results);
    }

    InterviewQuestion nextQuestion = interviewQuestionRepository.findBySessionIdAndQuestionOrder(session.getId(), question.getQuestionOrder() + 1).orElseThrow(
            () -> new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Next question not found."));

    interviewSessionRepository.save(session);
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

    return toInterviewResults(session);
  }

  @Transactional(readOnly = true)
  public Page<InterviewSessionSummaryResponse> getHistory(User user, Pageable pageable) {
    return interviewSessionRepository.findByUserIdOrderByStartedAtDesc(user.getId(), pageable).map(
            session -> new InterviewSessionSummaryResponse(
                    session.getId(), session.getCv().getId(), session.getCv().getOriginalFileName(), session.getJobPosition(), session.getLanguageCode(), session.getStatus().name(), session.getTotalQuestions(), session.getCurrentQuestionIndex(), session.getOverallScore(), session.getStartedAt(), session.getCompletedAt()));
  }

  private InterviewResultResponse completeInterview(InterviewSession session) {
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

    GeminiService.InterviewEvaluation evaluation = geminiService.evaluateInterview(
            session.getCv().getExtractedText(), session.getJobPosition(), questionAnswers);

    for (InterviewAnswer answer : answers) {
      evaluation.answerReviews().stream().filter(review -> review.questionOrder() == answer.getQuestion().getQuestionOrder()).findFirst().ifPresent(
              review -> {
                answer.setScore(review.score());
                answer.setFeedback(review.feedback());
                answer.setStrengths(writeList(review.strengths()));
                answer.setImprovements(writeList(review.improvements()));
              });
    }

    interviewAnswerRepository.saveAll(answers);
    session.setStatus(InterviewSessionStatus.COMPLETED);
    session.setCompletedAt(java.time.LocalDateTime.now());
    session.setOverallScore(evaluation.overallScore());
    session.setOverallSummary(evaluation.summary());
    session.setOverallStrengths(writeList(evaluation.strengths()));
    session.setOverallImprovements(writeList(evaluation.improvements()));
    interviewSessionRepository.save(session);

    return toInterviewResults(session);
  }

  private InterviewResultResponse toInterviewResults(InterviewSession session) {
    List<InterviewAnswerReviewResponse> reviews = interviewAnswerRepository.findBySessionIdOrderByQuestionQuestionOrderAsc(session.getId()).stream().map(
            answer -> new InterviewAnswerReviewResponse(
                    answer.getQuestion().getId(), answer.getQuestion().getQuestionOrder(), answer.getQuestion().getCategory().name(), answer.getQuestion().getQuestionText(), answer.getAnswerText(), answer.getDurationSeconds(), answer.getScore(), answer.getFeedback(), readList(answer.getStrengths()), readList(answer.getImprovements()))).toList();

    return new InterviewResultResponse(
            session.getId(), session.getCv().getId(), session.getCv().getOriginalFileName(), session.getJobPosition(), session.getLanguageCode(), session.getOverallScore(), session.getOverallSummary(), readList(session.getOverallStrengths()), readList(session.getOverallImprovements()), reviews, session.getCompletedAt());
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
    return Math.max(0, Math.min(durationSeconds, maxDurationSeconds == null ? 120 : maxDurationSeconds));
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

  private void enforceDailyMockInterviewLimit(User user) {
    long usageCount = getTodayMockInterviewUsageCount(user);
    if (usageCount >= dailyMockInterviewLimit) {
      throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "You can only start %d mock interview time(s) per day. Please try again tomorrow.".formatted(dailyMockInterviewLimit));
    }
  }

  private long getTodayMockInterviewUsageCount(User user) {
    LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
    LocalDateTime endOfDay = startOfDay.plusDays(1);
    return aiUsageLogRepository.countByUserIdAndUsageTypeAndUsedAtBetween(
            user.getId(), AIUsageType.MOCK_INTERVIEW, startOfDay, endOfDay);
  }

  private void recordInterviewUsage(User user) {
    AIUsageLog usageLog = new AIUsageLog();
    usageLog.setUser(user);
    usageLog.setUsageType(AIUsageType.MOCK_INTERVIEW);
    aiUsageLogRepository.save(usageLog);
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
