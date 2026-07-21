package com.hustlink.backend.features.ai.rag;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.EmbeddingService;
import com.hustlink.backend.features.ai.embedding.VectorStoreClient;
import com.hustlink.backend.features.ai.embedding.dto.SimilarPoint;
import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.model.AIUsageType;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import com.hustlink.backend.features.ai.model.InterviewQuestionBank;
import com.hustlink.backend.features.ai.model.InterviewQuestionCategory;
import com.hustlink.backend.features.ai.rag.dto.InterviewQuestionBankImportRequest;
import com.hustlink.backend.features.ai.rag.dto.RagImportResponse;
import com.hustlink.backend.features.ai.rag.dto.RagQuestionContext;
import com.hustlink.backend.features.ai.rag.dto.RagStatsResponse;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.ai.repository.InterviewQuestionBankRepository;
import com.hustlink.backend.features.authentication.model.User;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.hustlink.backend.features.ai.util.LanguageUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@Slf4j
@RequiredArgsConstructor
public class RagInterviewServiceImpl implements RagInterviewService {
  public static final String INTERVIEW_QUESTION_COLLECTION = "interview_question_bank";
  private static final int DEFAULT_IMPORT_BATCH_SIZE = 25;
  private static final int DEFAULT_IMPORT_MAX_ITEMS_PER_RUN = 100;
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };

  private final EmbeddingService embeddingService;
  private final VectorStoreClient vectorStoreClient;
  private final InterviewQuestionBankRepository questionBankRepository;
  private final AIUsageLogRepository aiUsageLogRepository;
  private final ObjectMapper objectMapper;

  @Override
  public List<String> retrieveRelevantQuestions(
                                                String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK) {
    return retrieveRelevantQuestionContexts(cvSummary, jobPosition, requestedStacks, level, languageCode, topK).stream().map(this::formatQuestionText).toList();
  }

  @Override
  public List<RagQuestionContext> retrieveRelevantQuestionContexts(
                                                                   String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK) {
    if (topK <= 0) {
      return List.of();
    }

    PositionTaxonomy.PositionProfile requestedProfile = PositionTaxonomy.parse(jobPosition, requestedStacks);
    String query = "%s\nTarget position: %s".formatted(
            cvSummary == null ? "" : cvSummary, jobPosition == null ? "" : jobPosition);
    try {
      float[] queryVector = embeddingService.embed(query);
      List<SimilarPoint> points = searchPoints(queryVector, requestedProfile, level, languageCode, topK);
      return points.stream().filter(point -> matchesPosition(point.payload(), requestedProfile)).sorted(Comparator.comparingDouble(SimilarPoint::score).reversed()).map(this::toQuestionContext).filter(Objects::nonNull).distinct().limit(topK).toList();
    } catch (RuntimeException exception) {
      log.warn("op=rag_retrieve status=fallback reason={}", exception.getMessage());
      return List.of();
    }
  }

  private List<SimilarPoint> searchPoints(
                                          float[] queryVector, PositionTaxonomy.PositionProfile requestedProfile, InterviewLevel level, String languageCode, int topK) {
    Map<String, Object> levelAndLanguage = new LinkedHashMap<>();
    if (level != null) {
      levelAndLanguage.put("level", level.name());
    }
    if (isKnownPosition(requestedProfile)) {
      levelAndLanguage.put("positionKey", requestedProfile.canonicalPosition());
    }
    if (languageCode != null && !languageCode.isBlank()) {
      levelAndLanguage.put("languageCode", LanguageUtils.normalize(languageCode));
    }

    List<SimilarPoint> primary = vectorStoreClient.search(
            INTERVIEW_QUESTION_COLLECTION, queryVector, Math.max(topK * 2, topK), levelAndLanguage);
    if (primary.size() >= Math.min(5, topK)) {
      return primary;
    }

    Map<String, Object> levelOnly = new LinkedHashMap<>();
    if (level != null) {
      levelOnly.put("level", level.name());
    }
    if (isKnownPosition(requestedProfile)) {
      levelOnly.put("positionKey", requestedProfile.canonicalPosition());
    }
    List<SimilarPoint> multilingualFallback = vectorStoreClient.search(
            INTERVIEW_QUESTION_COLLECTION, queryVector, Math.max(topK * 3, topK), levelOnly);

    Map<String, SimilarPoint> merged = new LinkedHashMap<>();
    for (SimilarPoint point : primary) {
      merged.put(point.id(), point);
    }
    for (SimilarPoint point : multilingualFallback) {
      merged.putIfAbsent(point.id(), point);
    }
    List<SimilarPoint> strictPositionResults = merged.values().stream().sorted(Comparator.comparingDouble(SimilarPoint::score).reversed()).limit(Math.max(topK * 2, topK)).toList();
    if (!strictPositionResults.isEmpty()) {
      return strictPositionResults;
    }

    // Final fallback: if strict job position has no results at all, use same level + shared stacks.
    Map<String, Object> levelAnyPosition = new LinkedHashMap<>();
    if (level != null) {
      levelAnyPosition.put("level", level.name());
    }
    List<SimilarPoint> wideCandidates = vectorStoreClient.search(
            INTERVIEW_QUESTION_COLLECTION, queryVector, Math.max(topK * 4, topK), levelAnyPosition);
    return wideCandidates.stream().filter(point -> sharesStack(point.payload(), requestedProfile)).sorted(Comparator.comparingDouble((SimilarPoint point) -> positionScore(point.payload(), requestedProfile)).reversed()).limit(Math.max(topK * 2, topK)).toList();
  }

  @Override
  public void indexQuestion(InterviewQuestionBank question) {
    if (question.getVectorId() == null || question.getVectorId().isBlank()) {
      question.setVectorId(UUID.randomUUID().toString());
    }
    question.setLanguageCode(LanguageUtils.normalize(question.getLanguageCode()));
    question.setIndexedAt(LocalDateTime.now());

    List<String> expectedPoints = readList(question.getExpectedPoints());
    PositionTaxonomy.PositionProfile positionProfile = PositionTaxonomy.parse(question.getTargetPosition(), List.of());
    String indexText = buildQuestionIndexText(question, expectedPoints);
    float[] vector = embeddingService.embed(indexText);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("category", question.getCategory().name());
    payload.put("position", question.getTargetPosition());
    payload.put("level", question.getLevel().name());
    payload.put("difficulty", question.getDifficulty() == null ? "" : question.getDifficulty());
    payload.put("source", question.getSource() == null ? "" : question.getSource());
    payload.put("expectedPoints", expectedPoints);
    payload.put("positionKey", positionProfile.canonicalPosition());
    payload.put("stacks", positionProfile.stacks().stream().sorted().toList());
    payload.put("languageCode", question.getLanguageCode());
    payload.put("sourceText", question.getQuestionText());
    payload.put("indexText", indexText);
    vectorStoreClient.upsert(
            INTERVIEW_QUESTION_COLLECTION, question.getVectorId(), vector, payload);
  }

  @Override
  public void reindexAll() {
    List<InterviewQuestionBank> questions = questionBankRepository.findAll();
    log.info("op=rag_reindex_all total_questions={}", questions.size());

    int batchSize = 50;
    int processedCount = 0;
    for (int start = 0; start < questions.size(); start += batchSize) {
      int end = Math.min(start + batchSize, questions.size());
      List<InterviewQuestionBank> batch = questions.subList(start, end);

      indexQuestionBatch(batch);
      questionBankRepository.saveAll(batch);
      processedCount += batch.size();
      log.info("op=rag_reindex_batch progress={}/{}", end, questions.size());

      if (end < questions.size()) {
        try {
          if (processedCount % 100 == 0) {
            log.info("op=rag_reindex action=rate_limit_sleep_1m processed={}", processedCount);
            Thread.sleep(60000); // Nghỉ 1 phút
          } else {
            Thread.sleep(1500);
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          throw new IllegalStateException("Reindex sleep interrupted", e);
        }
      }
    }
  }

  @Override
  @Transactional
  public RagImportResponse importQuestions(User admin, List<InterviewQuestionBankImportRequest> requests) {
    if (requests == null || requests.isEmpty()) {
      return new RagImportResponse(0, 0, 0);
    }

    Set<String> existingSignatures = questionBankRepository.findAll().stream().map(this::buildQuestionSignature).collect(Collectors.toCollection(LinkedHashSet::new));
    List<InterviewQuestionBank> candidates = requests.stream().map(this::toQuestionBank).filter(Objects::nonNull).toList();
    List<InterviewQuestionBank> pendingQuestions = filterPendingQuestions(candidates, existingSignatures);
    int skippedCount = candidates.size() - pendingQuestions.size();
    List<InterviewQuestionBank> questions = pendingQuestions.stream().limit(DEFAULT_IMPORT_MAX_ITEMS_PER_RUN).toList();
    int imported = 0;
    for (int start = 0; start < questions.size(); start += DEFAULT_IMPORT_BATCH_SIZE) {
      int end = Math.min(start + DEFAULT_IMPORT_BATCH_SIZE, questions.size());
      List<InterviewQuestionBank> batch = questions.subList(start, end);
      indexQuestionBatch(batch);
      questionBankRepository.saveAll(batch);
      imported += batch.size();
      log.info("op=rag_import_batch progress={}/{} remaining={}", imported, questions.size(), Math.max(0, pendingQuestions.size() - imported));
    }

    for (int i = 0; i < imported; i++) {
      recordAiUsage(admin, AIUsageType.EMBEDDING);
    }
    return new RagImportResponse(imported, skippedCount, Math.max(0, pendingQuestions.size() - imported));
  }

  @Override
  @Transactional
  public RagStatsResponse reindexAllAndStats(User admin) {
    reindexAll();
    recordAiUsage(admin, AIUsageType.EMBEDDING);
    return getStats();
  }

  @Override
  @Transactional(readOnly = true)
  public RagStatsResponse getStats() {
    List<InterviewQuestionBank> questions = questionBankRepository.findAll();
    Map<String, Long> byLevel = questions.stream().collect(Collectors.groupingBy(
            question -> question.getLevel().name(), Collectors.counting()));
    Map<String, Long> byLanguage = questions.stream().collect(Collectors.groupingBy(
            InterviewQuestionBank::getLanguageCode, Collectors.counting()));
    Map<String, Long> byCategory = questions.stream().collect(Collectors.groupingBy(
            question -> question.getCategory().name(), Collectors.counting()));
    return new RagStatsResponse(questions.size(), byLevel, byLanguage, byCategory);
  }

  private InterviewQuestionBank toQuestionBank(InterviewQuestionBankImportRequest request) {
    if (request == null || request.questionText() == null || request.questionText().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "questionText is required.");
    }
    if (request.targetPosition() == null || request.targetPosition().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetPosition is required.");
    }

    InterviewQuestionBank question = new InterviewQuestionBank();
    question.setQuestionText(request.questionText().trim());
    question.setTargetPosition(request.targetPosition().trim());
    question.setLevel(InterviewLevel.fromValue(request.level()));
    question.setCategory(request.category() == null ? InterviewQuestionCategory.GENERAL : request.category());
    question.setDifficulty(normalizeUpper(request.difficulty()));
    question.setExpectedPoints(writeList(request.expectedPoints()));
    question.setSource(trimToNull(request.source()));
    question.setLanguageCode(LanguageUtils.normalize(request.languageCode()));
    return question;
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

  private RagQuestionContext toQuestionContext(SimilarPoint point) {
    Object sourceText = point.payload().get("sourceText");
    if (!(sourceText instanceof String text) || text.isBlank()) {
      return null;
    }

    Object position = point.payload().get("position");
    Object level = point.payload().get("level");
    Object category = point.payload().get("category");
    Object difficulty = point.payload().get("difficulty");
    Object source = point.payload().get("source");
    Object languageCode = point.payload().get("languageCode");
    List<String> expectedPoints = toStringList(point.payload().get("expectedPoints"));
    return new RagQuestionContext(
            text, position instanceof String value ? value : "", level instanceof String value ? value : "", category instanceof String value ? value : "", difficulty instanceof String value ? value : "", expectedPoints, source instanceof String value ? value : "", languageCode instanceof String value ? value : "");
  }

  private boolean matchesPosition(Map<String, Object> payload, PositionTaxonomy.PositionProfile requestedProfile) {
    if (requestedProfile == null || requestedProfile.canonicalPosition().isBlank()) {
      return true;
    }
    if (isKnownPosition(requestedProfile)) {
      Object positionKey = payload.get("positionKey");
      if (positionKey instanceof String key && !key.isBlank()) {
        return PositionTaxonomy.canonicalLabel(key).equals(PositionTaxonomy.canonicalLabel(requestedProfile.canonicalPosition()));
      }
    }

    PositionTaxonomy.PositionProfile indexedProfile = profileFromPayload(payload);
    if (indexedProfile == null) {
      return true;
    }

    String requestedKey = PositionTaxonomy.canonicalLabel(requestedProfile.canonicalPosition());
    String indexedKey = PositionTaxonomy.canonicalLabel(indexedProfile.canonicalPosition());
    boolean knownRequested = !requestedKey.equals("unknown");
    boolean knownIndexed = !indexedKey.equals("unknown");
    if (knownRequested && knownIndexed && !requestedKey.equals(indexedKey)) {
      return false;
    }

    return !knownRequested || !knownIndexed || requestedKey.equals(indexedKey);
  }

  private double positionScore(Map<String, Object> payload, PositionTaxonomy.PositionProfile requestedProfile) {
    if (requestedProfile == null) {
      return 0d;
    }
    PositionTaxonomy.PositionProfile indexedProfile = profileFromPayload(payload);
    if (indexedProfile == null) {
      return 0d;
    }

    String requestedKey = PositionTaxonomy.canonicalLabel(requestedProfile.canonicalPosition());
    String indexedKey = PositionTaxonomy.canonicalLabel(indexedProfile.canonicalPosition());
    double score = 0d;
    if (!requestedKey.equals("unknown") && requestedKey.equals(indexedKey)) {
      score += 3.0d;
    }
    if (!requestedProfile.normalizedPosition().isBlank() && !indexedProfile.normalizedPosition().isBlank() && indexedProfile.normalizedPosition().contains(requestedProfile.normalizedPosition())) {
      score += 1.5d;
    }

    Set<String> sharedStacks = PositionTaxonomy.sharedStacks(indexedProfile, requestedProfile);
    score += Math.min(sharedStacks.size() * 0.8d, 2.4d);
    return score;
  }

  private PositionTaxonomy.PositionProfile profileFromPayload(Map<String, Object> payload) {
    Object position = payload.get("position");
    if (!(position instanceof String value) || value.isBlank()) {
      return null;
    }
    List<String> stacks = toStringList(payload.get("stacks"));
    return PositionTaxonomy.parse(value, stacks);
  }

  private boolean isKnownPosition(PositionTaxonomy.PositionProfile profile) {
    return profile != null && profile.canonicalPosition() != null && !profile.canonicalPosition().isBlank() && !"unknown".equals(PositionTaxonomy.canonicalLabel(profile.canonicalPosition()));
  }

  private boolean sharesStack(Map<String, Object> payload, PositionTaxonomy.PositionProfile requestedProfile) {
    if (requestedProfile == null || requestedProfile.stacks() == null || requestedProfile.stacks().isEmpty()) {
      return false;
    }
    PositionTaxonomy.PositionProfile indexedProfile = profileFromPayload(payload);
    if (indexedProfile == null) {
      return false;
    }
    return !PositionTaxonomy.sharedStacks(indexedProfile, requestedProfile).isEmpty();
  }


  private String normalizeUpper(String value) {
    String trimmed = trimToNull(value);
    return trimmed == null ? null : trimmed.toUpperCase(Locale.ROOT);
  }

  private String trimToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private String writeList(List<String> items) {
    try {
      return objectMapper.writeValueAsString(items == null ? List.of() : items);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to store expected points.", exception);
    }
  }

  private List<String> readList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(value, STRING_LIST);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Failed to read expected points.", exception);
    }
  }

  private List<String> toStringList(Object value) {
    if (value instanceof List<?> items) {
      return items.stream().filter(String.class::isInstance).map(String.class::cast).toList();
    }
    if (value instanceof String text && !text.isBlank()) {
      return readList(text);
    }
    return List.of();
  }

  private String formatQuestionText(RagQuestionContext context) {
    String points = context.expectedPoints().isEmpty() ? "" : " | Expected points: " + String.join("; ", context.expectedPoints());
    return "[%s %s] %s%s".formatted(
            context.targetPosition(), context.level(), context.questionText(), points);
  }

  private String buildQuestionIndexText(InterviewQuestionBank question, List<String> expectedPoints) {
    if (expectedPoints == null || expectedPoints.isEmpty()) {
      return question.getQuestionText();
    }
    return "%s\nExpected points: %s".formatted(
            question.getQuestionText(), String.join(", ", expectedPoints));
  }

  private void indexQuestionBatch(List<InterviewQuestionBank> questions) {
    if (questions == null || questions.isEmpty()) {
      return;
    }

    List<String> indexTexts = questions.stream().map(question -> {
      if (question.getVectorId() == null || question.getVectorId().isBlank()) {
        question.setVectorId(UUID.randomUUID().toString());
      }
      question.setLanguageCode(LanguageUtils.normalize(question.getLanguageCode()));
      question.setIndexedAt(LocalDateTime.now());
      List<String> expectedPoints = readList(question.getExpectedPoints());
      return buildQuestionIndexText(question, expectedPoints);
    }).toList();

    List<float[]> vectors = embeddingService.embedBatch(indexTexts);
    if (vectors.size() != questions.size()) {
      throw new IllegalStateException("Mismatch between questions and returned embedding vectors.");
    }

    for (int i = 0; i < questions.size(); i++) {
      InterviewQuestionBank question = questions.get(i);
      List<String> expectedPoints = readList(question.getExpectedPoints());
      PositionTaxonomy.PositionProfile positionProfile = PositionTaxonomy.parse(question.getTargetPosition(), List.of());
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("category", question.getCategory().name());
      payload.put("position", question.getTargetPosition());
      payload.put("level", question.getLevel().name());
      payload.put("difficulty", question.getDifficulty() == null ? "" : question.getDifficulty());
      payload.put("source", question.getSource() == null ? "" : question.getSource());
      payload.put("expectedPoints", expectedPoints);
      payload.put("positionKey", positionProfile.canonicalPosition());
      payload.put("stacks", positionProfile.stacks().stream().sorted().toList());
      payload.put("languageCode", question.getLanguageCode());
      payload.put("sourceText", question.getQuestionText());
      payload.put("indexText", indexTexts.get(i));
      vectorStoreClient.upsert(
              INTERVIEW_QUESTION_COLLECTION, question.getVectorId(), vectors.get(i), payload);
    }
  }

  private List<InterviewQuestionBank> filterPendingQuestions(List<InterviewQuestionBank> candidates, Set<String> existingSignatures) {
    Set<String> seen = new LinkedHashSet<>(existingSignatures);
    return candidates.stream().filter(question -> seen.add(buildQuestionSignature(question))).toList();
  }

  private String buildQuestionSignature(InterviewQuestionBank question) {
    return "%s|%s|%s|%s".formatted(
            normalizeSignatureText(question.getQuestionText()), normalizeSignatureText(question.getTargetPosition()), question.getLevel() == null ? "" : question.getLevel().name(), normalizeSignatureText(question.getLanguageCode()));
  }

  private String normalizeSignatureText(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    return value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
  }
}
