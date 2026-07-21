package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class GeminiService {
  private static final List<String> VIETNAMESE_HINTS = List.of(
          "kinh nghiệm", "học vấn", "kỹ năng", "dự án", "mục tiêu", "tóm tắt", "công việc", "chứng chỉ", "thực tập", "đại học");

  private final RestTemplate restTemplate;
  private final ObjectMapper objectMapper;

  @Value("${gemini.api.key:}")
  private String apiKey;

  @Value("${gemini.model:gemini-3-flash}")
  private String model;

  @Value("${gemini.fallback-models:gemini-2.5-flash,gemini-3.1-flash-lite,gemini-2.5-flash-lite}")
  private String fallbackModels;

  @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta/models}")
  private String baseUrl;

  @Value("${ai.pricing.gemini-3-flash.input:0.075}")
  private double priceInput;

  @Value("${ai.pricing.gemini-3-flash.output:0.30}")
  private double priceOutput;

  public record TokenUsage(int promptTokens, int completionTokens, BigDecimal estimatedCostUsd) {
  }

  private static final ThreadLocal<TokenUsage> lastTokenUsage = new ThreadLocal<>();

  public static TokenUsage getLastTokenUsage() {
    return lastTokenUsage.get();
  }

  public static void clearLastTokenUsage() {
    lastTokenUsage.remove();
  }

  public boolean isConfigured() {
    return apiKey != null && !apiKey.isBlank();
  }

  public CVInsight analyzeCv(String cvText) {
    if (!isConfigured()) {
      throw new IllegalStateException("Gemini API key is not configured.");
    }

    AnalysisLanguage analysisLanguage = detectLanguage(cvText);
    String prompt = """
                    You are an expert recruiter and interview coach.
                    Analyze the following CV text and return valid JSON only with this exact schema:
                    {
                      "scoreBreakdown": {
                        "experienceMatch": number,
                        "skillsMatch": number,
                        "evidence": number,
                        "educationAndDomain": number,
                        "cvClarity": number
                      },
                      "summary": "string",
                      "strengths": ["string"],
                      "improvements": ["string"],
                      "skills": ["string"],
                      "matchReasons": ["string"],
                      "matchGaps": ["string"]
                    }

            Rules:
            - This is a JD-specific review, not a generic CV review.
            - The system calculates the CV score as the sum of scoreBreakdown. Use this fixed rubric:
              experienceMatch: 0-30 for years, seniority, and relevant responsibilities against the JD;
              skillsMatch: 0-25 for required technologies, tools, and capabilities;
              evidence: 0-20 for projects and achievements that prove the requirements;
              educationAndDomain: 0-15 for education, certifications, and relevant domain knowledge;
              cvClarity: 0-10 for clear, targeted, ATS-friendly evidence in the CV.
            - Do not award points for a JD requirement that the CV does not explicitly support.
            - strengths should contain 3 to 5 concise bullet-style strings.
            - improvements should contain 3 to 5 detailed, actionable CV rewrite recommendations.
            - skills should contain up to 20 key technical and soft skills extracted from the CV (prefer Vietnamese/English as appropriate).
            - Every improvement must follow this structure: [What is missing or weak in the CV] + [Why it matters for this exact JD] + [How to rewrite it, including a short example phrase when possible].
            - Do not invent achievements, metrics, technologies, employers, or projects. When evidence is missing, tell the candidate to add it only if truthful.
            - Prefer concrete rewrites such as which experience/project section to edit, which JD keyword to use naturally, and what evidence or metric to add.
            - Use professional tone and active verbs (e.g., "Optimize", "Quantify", "Refine", "Standardize").
            - Focus on professional impact rather than just pointing out mistakes.
            - Each improvement may use up to 3 concise sentences, but must remain readable in a CV feedback panel.
            - matchReasons should contain 3 concise, JD-specific reasons the candidate matches.
            - matchGaps should contain 3 concise, JD-specific missing or weak requirements.
            - Keep the JSON keys exactly as provided above.
            - Write summary, strengths, and improvements in %s.
            - Do not wrap JSON in markdown.

                    CV:
                    %s
                    """.formatted(analysisLanguage.instructionLabel(), cvText);

    prompt = appendCurrentTimeContext(prompt);

    Map<String, Object> payload = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))), "generationConfig", Map.of("temperature", 0.3, "responseMimeType", "application/json"));

    JsonNode root = requestJson("analyzeCv", payload);
    if (root == null) {
      throw new IllegalStateException("Gemini returned an empty response.");
    }

    JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
    if (textNode.isMissingNode() || textNode.asText().isBlank()) {
      throw new IllegalStateException("Gemini did not return analysis text.");
    }

    try {
      JsonNode analysis = objectMapper.readTree(textNode.asText());
      JsonNode scoreBreakdown = analysis.path("scoreBreakdown");
      int score = clampScore(
              clampRange(scoreBreakdown.path("experienceMatch").asInt(0), 0, 30) + clampRange(scoreBreakdown.path("skillsMatch").asInt(0), 0, 25) + clampRange(scoreBreakdown.path("evidence").asInt(0), 0, 20) + clampRange(scoreBreakdown.path("educationAndDomain").asInt(0), 0, 15) + clampRange(scoreBreakdown.path("cvClarity").asInt(0), 0, 10));
      return new CVInsight(
              score, analysis.path("summary").asText(""), toList(analysis.path("strengths")), toList(analysis.path("improvements")), toList(analysis.path("skills")), toList(analysis.path("matchReasons")), toList(analysis.path("matchGaps")));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Gemini returned invalid JSON analysis.", exception);
    }
  }

  public List<InterviewQuestionDraft> generateInterviewQuestions(
                                                                 String cvText, String jobPosition, int numberOfQuestions) {
    return generateInterviewQuestions(cvText, jobPosition, "JUNIOR", numberOfQuestions, List.of());
  }

  public List<InterviewQuestionDraft> generateInterviewQuestions(
                                                                 String cvText, String jobPosition, String level, int numberOfQuestions, List<String> ragContext) {
    if (!isConfigured()) {
      throw new IllegalStateException("Gemini API key is not configured.");
    }

    AnalysisLanguage analysisLanguage = detectLanguage(cvText);
    String prompt = """
            You are an experienced interviewer running a realistic mock interview.
            Based on the candidate CV and target job, generate exactly %d interview questions.

            Return valid JSON only with this exact schema:
            {
              "questions": [
                {
                  "questionOrder": number,
                  "text": "string",
                  "category": "TECHNICAL|BEHAVIORAL|PROJECT|COMMUNICATION|PROBLEM_SOLVING|GENERAL",
                  "expectedPoints": ["string"]
                }
              ]
            }

            Rules:
            - Generate exactly %d questions.
            - Calibrate difficulty for candidate level: %s.
            - If level is INTERN/FRESHER, prioritize fundamentals and simple project depth.
            - If level is JUNIOR, balance fundamentals, debugging, and real project trade-offs.
            - If level is SENIOR, emphasize architecture, ownership, trade-offs, and leadership communication.
            - The selected level is a hard constraint. Do not increase difficulty beyond the selected level even if the CV looks stronger.
            - Use the CV only to personalize technologies, project examples, and domain context.
            - For INTERN, avoid deep architecture, large-scale system design, or production incident ownership questions.
            - For FRESHER, avoid senior-level trade-off or large-scale architecture questions unless they are simplified to fundamentals.
            - Balance the questions across technical skill, past experience, project work, and communication.
            - expectedPoints are an answer rubric used later for deterministic answer-coverage scoring, not generic discussion prompts.
            - expectedPoints must contain 3 to 5 atomic, factual answer criteria for this exact question.
            - Every point must state a core idea a good candidate should explain, using a short complete assertion or a precise technical concept.
            - Never use generic labels such as "use case", "key features", "example", "impact", "validation", "edge cases", or a restatement of the question.
            - Do not make optional framework names, libraries, vendors, or tools mandatory expected points. Keep examples such as TensorRT, OpenVINO, AWS, or React only in the question or expected answer explanation when truly necessary; score the underlying concept instead.
            - A candidate who explains the correct core concept using an equivalent technology, vocabulary, or example must still be considered correct.
            - For comparison questions, cover each side of the comparison and the important trade-off. For behavioral/project questions, cover situation, candidate action, reasoning, and measurable outcome where applicable.
            - questionOrder must start from 1 and increase by 1.
            - Write all question text and expectedPoints in %s.
            - Do not wrap JSON in markdown.

            Target Job Position:
            %s

            Reference Questions (do NOT copy verbatim, use as style/topic inspiration):
            %s

            Candidate CV:
            %s
            """.formatted(
            numberOfQuestions, numberOfQuestions, level, analysisLanguage.instructionLabel(), jobPosition, formatRagContext(ragContext), trimToMaxChars(cvText, 12000));

    prompt = appendCurrentTimeContext(prompt);

    Map<String, Object> payload = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))), "generationConfig", Map.of("temperature", 0.4, "responseMimeType", "application/json"));

    JsonNode root = requestJson("generateInterviewQuestions", payload);
    JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
    if (textNode.isMissingNode() || textNode.asText().isBlank()) {
      throw new IllegalStateException("Gemini did not return interview questions.");
    }

    try {
      JsonNode questionRoot = objectMapper.readTree(textNode.asText());
      List<InterviewQuestionDraft> questions = new ArrayList<>();
      JsonNode questionsNode = questionRoot.path("questions");
      if (questionsNode.isArray()) {
        questionsNode.forEach(
                questionNode -> {
                  String text = questionNode.path("text").asText("").trim();
                  if (!text.isBlank()) {
                    questions.add(
                            new InterviewQuestionDraft(
                                    questions.size() + 1, text, questionNode.path("category").asText("GENERAL"), toList(questionNode.path("expectedPoints"))));
                  }
                });
      }
      return questions;
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Gemini returned invalid question JSON.", exception);
    }
  }

  public InterviewEvaluation evaluateInterview(
                                               String cvText, String jobPosition, List<InterviewQuestionAnswerDraft> questionAnswers) {
    return evaluateInterview(cvText, jobPosition, "JUNIOR", questionAnswers, List.of());
  }

  public InterviewEvaluation evaluateInterview(
                                               String cvText, String jobPosition, String level, List<InterviewQuestionAnswerDraft> questionAnswers, List<String> ragEvaluationContext) {
    if (!isConfigured()) {
      throw new IllegalStateException("Gemini API key is not configured.");
    }

    AnalysisLanguage analysisLanguage = detectLanguage(cvText);
    String questionAnswerBlock = questionAnswers.stream().map(
            item -> """
                    Question %d
                    Category: %s
                    Question: %s
                    Expected Points: %s
                    Candidate Answer: %s
                    """.formatted(
                    item.questionOrder(), item.category(), item.questionText(), String.join(", ", item.expectedPoints()), item.answerText())).reduce("", (left, right) -> left + "\n" + right).trim();

    String prompt = """
                    You are an expert interviewer evaluating a completed mock interview.
                    Review the candidate answers and return valid JSON only with this exact schema:
                    {
                      "overallScore": number,
                      "summary": "string",
                      "strengths": ["string"],
                      "improvements": ["string"],
                      "answerReviews": [
                        {
                          "questionOrder": number,
                          "score": number,
                          "feedback": "string",
                          "strengths": ["string"],
                          "improvements": ["string"]
                        }
                      ]
                    }

            Rules:
            - overallScore and each score must be between 0 and 100.
            - Evaluate against expected level: %s.
            - INTERN/FRESHER: reward clarity of fundamentals and learning mindset.
            - JUNIOR: reward practical implementation details and debugging logic.
            - SENIOR: reward system trade-offs, stakeholder communication, and risk management.
            - The selected level is a hard constraint. Do not judge the candidate against a higher level even if the CV mentions stronger technologies or broader exposure.
            - Treat CV strength as context only, not as a reason to raise the scoring bar above the selected level.
            - strengths and improvements should each contain 3 to 5 concise strings.
            - Each improvement should mention the exact weakness in the answer or interview performance and one short way to improve it.
            - Keep each improvement short enough to fit in 2 or 3 short sentences.
            - answerReviews must contain one item for every question.
            - feedback should be concise but specific.
            - For each answerReview, feedback should clearly say what was missing or weak and what better point the candidate should mention next time.
            - Write summary, strengths, improvements, and feedback in %s.
            - Do not wrap JSON in markdown.

                    Target Job Position:
                    %s

                    Expected Candidate Level:
                    %s

                    Candidate CV Context (for personalization only, not to raise difficulty expectations):
                    %s

                    Reference Evaluation Rubrics (use as guidance, do not copy verbatim):
                    %s

                    Interview Transcript:
                    %s
                    """.formatted(
            level, analysisLanguage.instructionLabel(), jobPosition, level, trimToMaxChars(cvText, 4000), formatRagContext(ragEvaluationContext), questionAnswerBlock);

    prompt = appendCurrentTimeContext(prompt);

    Map<String, Object> payload = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))), "generationConfig", Map.of("temperature", 0.2, "responseMimeType", "application/json"));

    JsonNode root = requestJson("evaluateInterview", payload);
    JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
    if (textNode.isMissingNode() || textNode.asText().isBlank()) {
      throw new IllegalStateException("Gemini did not return interview evaluation.");
    }

    try {
      JsonNode evaluationRoot = objectMapper.readTree(textNode.asText());
      List<InterviewAnswerReview> reviews = new ArrayList<>();
      JsonNode reviewsNode = evaluationRoot.path("answerReviews");
      if (reviewsNode.isArray()) {
        reviewsNode.forEach(
                reviewNode -> reviews.add(
                        new InterviewAnswerReview(
                                reviewNode.path("questionOrder").asInt(), clampScore(reviewNode.path("score").asInt(0)), reviewNode.path("feedback").asText(""), toList(reviewNode.path("strengths")), toList(reviewNode.path("improvements")))));
      }

      return new InterviewEvaluation(
              clampScore(evaluationRoot.path("overallScore").asInt(0)), evaluationRoot.path("summary").asText(""), toList(evaluationRoot.path("strengths")), toList(evaluationRoot.path("improvements")), reviews);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(
              "Gemini returned invalid interview evaluation JSON.", exception);
    }
  }

  public String resolveInterviewLanguageCode(String cvText) {
    return detectLanguage(cvText).speechTag();
  }

  private int clampScore(int score) {
    return Math.max(0, Math.min(100, score));
  }

  private int clampRange(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }

  private AnalysisLanguage detectLanguage(String cvText) {
    if (cvText == null || cvText.isBlank()) {
      return AnalysisLanguage.ENGLISH;
    }

    String normalized = cvText.toLowerCase();
    long hintMatches = VIETNAMESE_HINTS.stream().filter(normalized::contains).count();
    boolean hasVietnameseCharacters = normalized.chars().anyMatch(this::isVietnameseCharacter);

    if (hasVietnameseCharacters || hintMatches >= 2) {
      return AnalysisLanguage.VIETNAMESE;
    }

    return AnalysisLanguage.ENGLISH;
  }

  private boolean isVietnameseCharacter(int codePoint) {
    return "ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ".indexOf(Character.toLowerCase(codePoint)) >= 0;
  }

  private String appendCurrentTimeContext(String prompt) {
    java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    String formattedTime = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    return "[System Context - Current Date and Time: " + formattedTime + "]\n" + prompt;
  }

  private JsonNode requestJson(String operation, Map<String, Object> payload) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("x-goog-api-key", apiKey);

    HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
    List<String> attemptedModels = new ArrayList<>();

    for (String candidateModel : resolveCandidateModels()) {
      attemptedModels.add(candidateModel);
      String endpoint = "%s/%s:generateContent".formatted(baseUrl, candidateModel);
      log.info("Gemini {} trying model={}", operation, candidateModel);
      try {
        ResponseEntity<JsonNode> response = restTemplate.exchange(endpoint, HttpMethod.POST, request, JsonNode.class);
        log.info("Gemini {} succeeded with model={}", operation, candidateModel);
        JsonNode responseBody = response.getBody();
        if (responseBody != null) {
          JsonNode usageNode = responseBody.path("usageMetadata");
          if (!usageNode.isMissingNode()) {
            int promptTokens = usageNode.path("promptTokenCount").asInt(0);
            int completionTokens = usageNode.path("candidatesTokenCount").asInt(0);
            double cost = (promptTokens * priceInput + completionTokens * priceOutput) / 1000000.0;
            BigDecimal costBd = BigDecimal.valueOf(cost).setScale(6, RoundingMode.HALF_UP);
            addTokenUsage(new TokenUsage(promptTokens, completionTokens, costBd));
          } else {
            addTokenUsage(new TokenUsage(0, 0, BigDecimal.ZERO));
          }
        } else {
          addTokenUsage(new TokenUsage(0, 0, BigDecimal.ZERO));
        }
        return responseBody;
      } catch (RestClientResponseException exception) {
        if (shouldTryNextModel(exception)) {
          log.warn(
                  "Gemini {} model={} unavailable, trying next fallback. status={} body={}", operation, candidateModel, exception.getStatusCode().value(), sanitizeLogBody(exception.getResponseBodyAsString()));
          continue;
        }

        log.error(
                "Gemini {} failed with model={} status={} body={}", operation, candidateModel, exception.getStatusCode().value(), sanitizeLogBody(exception.getResponseBodyAsString()));
        throw new IllegalStateException(
                "Gemini request failed for model '%s': %s".formatted(candidateModel, extractErrorMessage(exception)), exception);
      }
    }

    log.error("Gemini {} exhausted all fallback models={}", operation, attemptedModels);
    throw new IllegalStateException(
            "No supported Gemini model was available for generateContent. Tried: %s".formatted(String.join(", ", attemptedModels)));
  }

  private void addTokenUsage(TokenUsage usage) {
    TokenUsage current = lastTokenUsage.get();
    if (current == null) {
      lastTokenUsage.set(usage);
      return;
    }
    lastTokenUsage.set(new TokenUsage(
            current.promptTokens() + usage.promptTokens(), current.completionTokens() + usage.completionTokens(), current.estimatedCostUsd().add(usage.estimatedCostUsd())));
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

  private String formatRagContext(List<String> ragContext) {
    if (ragContext == null || ragContext.isEmpty()) {
      return "- No external reference questions were retrieved.";
    }
    return ragContext.stream().filter(question -> question != null && !question.isBlank()).limit(12).map(question -> "- " + trimToMaxChars(question.trim(), 500)).reduce("", (left, right) -> left.isBlank() ? right : left + "\n" + right);
  }

  private List<String> resolveCandidateModels() {
    Set<String> models = new LinkedHashSet<>();
    if (model != null && !model.isBlank()) {
      models.add(model.trim());
    }
    if (fallbackModels != null && !fallbackModels.isBlank()) {
      for (String fallbackModel : fallbackModels.split(",")) {
        String normalizedModel = fallbackModel.trim();
        if (!normalizedModel.isBlank()) {
          models.add(normalizedModel);
        }
      }
    }
    return new ArrayList<>(models);
  }

  private boolean isUnsupportedModel(RestClientResponseException exception) {
    if (exception.getStatusCode().value() != 404) {
      return false;
    }

    String responseBody = exception.getResponseBodyAsString();
    return responseBody != null && (responseBody.contains("not found for API version") || responseBody.contains("is not supported for generateContent") || responseBody.contains("\"NOT_FOUND\""));
  }

  private boolean isTemporarilyUnavailable(RestClientResponseException exception) {
    int statusCode = exception.getStatusCode().value();
    if (statusCode != 429 && statusCode != 503) {
      return false;
    }

    String responseBody = exception.getResponseBodyAsString();
    if (responseBody == null || responseBody.isBlank()) {
      return true;
    }

    return responseBody.contains("\"UNAVAILABLE\"") || responseBody.contains("\"RESOURCE_EXHAUSTED\"") || responseBody.toLowerCase().contains("high demand") || responseBody.toLowerCase().contains("try again later");
  }

  private boolean shouldTryNextModel(RestClientResponseException exception) {
    return isUnsupportedModel(exception) || isTemporarilyUnavailable(exception);
  }

  private String extractErrorMessage(RestClientResponseException exception) {
    String responseBody = exception.getResponseBodyAsString();
    if (responseBody == null || responseBody.isBlank()) {
      return exception.getMessage();
    }
    return responseBody;
  }

  private String sanitizeLogBody(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return "<empty>";
    }

    String singleLine = responseBody.replaceAll("\\s+", " ").trim();
    if (singleLine.length() <= 300) {
      return singleLine;
    }
    return singleLine.substring(0, 300) + "...";
  }

  private List<String> toList(JsonNode node) {
    List<String> items = new ArrayList<>();
    if (node == null || !node.isArray()) {
      return items;
    }

    node.forEach(
            item -> {
              String value = item.asText("").trim();
              if (!value.isBlank()) {
                items.add(value);
              }
            });
    return items;
  }

  private enum AnalysisLanguage {
    VIETNAMESE("Vietnamese", "vi-VN"), ENGLISH("English", "en-US");

    private final String instructionLabel;
    private final String speechTag;

    AnalysisLanguage(String instructionLabel, String speechTag) {
      this.instructionLabel = instructionLabel;
      this.speechTag = speechTag;
    }

    public String instructionLabel() {
      return instructionLabel;
    }

    public String speechTag() {
      return speechTag;
    }
  }

  public record CVInsight(Integer score, String summary, List<String> strengths, List<String> improvements,
                          List<String> skills, List<String> matchReasons, List<String> matchGaps) {
  }

  public record JobMatchInsight(List<String> reasons, List<String> gaps) {
  }

  public JobMatchInsight generateMatchReasoning(String cvText, String jobTitle, String jobDescription, Set<String> jobSkills) {
    if (!isConfigured()) {
      return new JobMatchInsight(List.of("Gemini API not configured"), List.of("Gemini API not configured"));
    }
    AnalysisLanguage analysisLanguage = detectLanguage(cvText);
    String prompt = """
            You are an expert HR system analyzing candidate suitability for a job.
            Given candidate's CV and job details, analyze strengths (reasons to hire) and gaps (areas of improvement/missing requirements).
            Return valid JSON only with this exact schema:
            {
              "reasons": ["string"],
              "gaps": ["string"]
            }
            Rules:
            - Provide 3 concise and specific bullet points for reasons in %s.
            - Provide 3 concise and specific bullet points for gaps in %s.
            - Do not wrap JSON in markdown.

            Job Title: %s
            Job Description: %s
            Job Skills Required: %s

            Candidate CV:
            %s
            """.formatted(analysisLanguage.instructionLabel(), analysisLanguage.instructionLabel(), jobTitle, jobDescription, String.join(", ", jobSkills), trimToMaxChars(cvText, 8000));

    prompt = appendCurrentTimeContext(prompt);

    Map<String, Object> payload = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))), "generationConfig", Map.of("temperature", 0.3, "responseMimeType", "application/json"));

    try {
      JsonNode root = requestJson("generateMatchReasoning", payload);
      JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
      if (textNode.isMissingNode() || textNode.asText().isBlank()) {
        return new JobMatchInsight(List.of("Không tìm thấy kết quả phân tích"), List.of("Không tìm thấy kết quả phân tích"));
      }
      JsonNode matchNode = objectMapper.readTree(textNode.asText());
      return new JobMatchInsight(toList(matchNode.path("reasons")), toList(matchNode.path("gaps")));
    } catch (Exception e) {
      log.warn("Failed to generate match reasoning: {}", e.getMessage());
      return new JobMatchInsight(List.of("Có lỗi trong quá trình phân tích"), List.of("Có lỗi trong quá trình phân tích"));
    }
  }

  public record InterviewQuestionDraft(
                                       int questionOrder, String text, String category, List<String> expectedPoints) {
  }

  public record InterviewQuestionAnswerDraft(
                                             int questionOrder,
                                             String questionText,
                                             String category,
                                             List<String> expectedPoints,
                                             String answerText) {
  }

  public record InterviewAnswerReview(
                                      int questionOrder,
                                      Integer score,
                                      String feedback,
                                      List<String> strengths,
                                      List<String> improvements) {
  }

  public record InterviewEvaluation(
                                    Integer overallScore,
                                    String summary,
                                    List<String> strengths,
                                    List<String> improvements,
                                    List<InterviewAnswerReview> answerReviews) {
  }
}
