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
                      "score": number,
                      "summary": "string",
                      "strengths": ["string"],
                      "improvements": ["string"]
                    }

            Rules:
            - score must be between 0 and 100.
            - strengths should contain 3 to 5 concise bullet-style strings.
            - improvements should contain 3 to 5 concise but specific bullet-style strings.
            - Each improvement must follow the structure: [Action Verb] + [Specific Weak Point] + [Practical Fix].
            - Use professional tone and active verbs (e.g., "Optimize", "Quantify", "Refine", "Standardize").
            - Focus on professional impact rather than just pointing out mistakes.
            - Limit each improvement to maximum 3 concise sentences.
            - Keep the JSON keys exactly as provided above.
            - Write summary, strengths, and improvements in %s.
            - Do not wrap JSON in markdown.

                    CV:
                    %s
                    """.formatted(analysisLanguage.instructionLabel(), cvText);

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
      return new CVInsight(
              clampScore(analysis.path("score").asInt(0)), analysis.path("summary").asText(""), toList(analysis.path("strengths")), toList(analysis.path("improvements")));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Gemini returned invalid JSON analysis.", exception);
    }
  }

  public List<InterviewQuestionDraft> generateInterviewQuestions(
                                                                 String cvText, String jobPosition, int numberOfQuestions) {
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
            - Balance the questions across technical skill, past experience, project work, and communication.
            - expectedPoints should contain 3 to 5 concise points.
            - questionOrder must start from 1 and increase by 1.
            - Write all question text and expectedPoints in %s.
            - Do not wrap JSON in markdown.

            Target Job Position:
            %s

            Candidate CV:
            %s
            """.formatted(
            numberOfQuestions, numberOfQuestions, analysisLanguage.instructionLabel(), jobPosition, trimToMaxChars(cvText, 12000));

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

                    Candidate CV Summary:
                    %s

                    Interview Transcript:
                    %s
                    """.formatted(
            analysisLanguage.instructionLabel(), jobPosition, trimToMaxChars(cvText, 4000), questionAnswerBlock);

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
        return response.getBody();
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

  private String trimToMaxChars(String text, int maxChars) {
    if (text == null) {
      return "";
    }
    if (text.length() <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars);
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

  public record CVInsight(Integer score, String summary, List<String> strengths, List<String> improvements) {
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
