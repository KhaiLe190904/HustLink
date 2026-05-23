package com.hustlink.backend.features.ai.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Service
@Slf4j
@RequiredArgsConstructor
public class GeminiEmbeddingService implements EmbeddingService {
  private static final int DEFAULT_MAX_BATCH_SIZE = 64;
  private static final int DEFAULT_RETRY_ATTEMPTS = 8;
  private static final long DEFAULT_RETRY_DELAY_MILLIS = 1500L;
  private static final Pattern RETRY_DELAY_SECONDS_PATTERN = Pattern.compile("Please retry in\\s+([0-9]+(?:\\.[0-9]+)?)s", Pattern.CASE_INSENSITIVE);
  private static final Pattern RETRY_DELAY_INFO_PATTERN = Pattern.compile("\"retryDelay\"\\s*:\\s*\"([0-9]+)s\"", Pattern.CASE_INSENSITIVE);
  private final RestTemplate restTemplate;

  @Value("${gemini.api.key:}")
  private String apiKey;

  @Value("${gemini.embedding.model:gemini-embedding-002}")
  private String embeddingModel;

  @Value("${gemini.embedding.dimension:3072}")
  private int embeddingDimension;

  @Value("${gemini.embedding.fallback-models:gemini-embedding-001}")
  private String embeddingFallbackModels;

  @Value("${gemini.embedding.output-dimensionality:0}")
  private int outputDimensionality;

  @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta/models}")
  private String baseUrl;

  private final AtomicInteger resolvedDimension = new AtomicInteger(0);

  @Override
  public float[] embed(String text) {
    validateApiKeyConfigured();
    HttpHeaders headers = buildHeaders();

    JsonNode values = null;
    String selectedModel = null;
    RestClientResponseException lastException = null;
    for (String candidateModel : resolveCandidateModels()) {
      try {
        ResponseEntity<JsonNode> response = executeEmbedRequest(candidateModel, buildEmbedRequest(candidateModel, text), headers, false);
        values = extractVectorValues(response.getBody());
        if (values != null && values.isArray() && !values.isEmpty()) {
          selectedModel = candidateModel;
          break;
        }
        throw new IllegalStateException("Gemini embedding response did not contain vector values.");
      } catch (RestClientResponseException exception) {
        if (shouldTryNextModel(exception)) {
          log.warn("op=gemini_embedding model={} status={} fallback=true", candidateModel, exception.getStatusCode().value());
          lastException = exception;
          continue;
        }
        throw new IllegalStateException("Gemini embedding failed: " + exception.getResponseBodyAsString(), exception);
      }
    }

    if (values == null || !values.isArray() || values.isEmpty()) {
      if (lastException != null) {
        throw new IllegalStateException("Gemini embedding failed for all candidate models: " + lastException.getResponseBodyAsString(), lastException);
      }
      throw new IllegalStateException("Gemini embedding response did not contain vector values.");
    }

    float[] vector = new float[values.size()];
    for (int i = 0; i < values.size(); i++) {
      vector[i] = (float) values.get(i).asDouble();
    }
    float[] normalizedVector = normalize(vector);
    resolvedDimension.compareAndSet(0, normalizedVector.length);
    log.info("op=gemini_embedding model={} dim={}", selectedModel == null ? embeddingModel : selectedModel, normalizedVector.length);
    return normalizedVector;
  }

  @Override
  public List<float[]> embedBatch(List<String> texts) {
    if (texts == null || texts.isEmpty()) {
      return List.of();
    }

    validateApiKeyConfigured();
    HttpHeaders headers = buildHeaders();
    List<float[]> embeddings = new ArrayList<>();
    for (int start = 0; start < texts.size(); start += DEFAULT_MAX_BATCH_SIZE) {
      int end = Math.min(start + DEFAULT_MAX_BATCH_SIZE, texts.size());
      List<String> chunk = texts.subList(start, end);
      embeddings.addAll(embedBatchChunk(chunk, headers));
    }
    if (embeddings.size() != texts.size()) {
      throw new IllegalStateException("Gemini batch embedding response size mismatch.");
    }
    return embeddings;
  }

  @Override
  public int dimension() {
    if (resolvedDimension.get() > 0) {
      return resolvedDimension.get();
    }
    if (outputDimensionality > 0) {
      return outputDimensionality;
    }
    if (embeddingDimension > 0) {
      return embeddingDimension;
    }
    float[] probe = embed("dimension probe");
    return probe.length;
  }

  private int resolveRequestedOutputDimensionality() {
    if (outputDimensionality > 0) {
      return outputDimensionality;
    }
    if (embeddingDimension > 0) {
      return embeddingDimension;
    }
    return 768;
  }

  private List<float[]> embedBatchChunk(List<String> texts, HttpHeaders headers) {
    for (String candidateModel : resolveCandidateModels()) {
      try {
        Map<String, Object> payload = new HashMap<>();
        payload.put("requests", texts.stream().map(text -> buildEmbedRequest(candidateModel, text)).toList());
        ResponseEntity<JsonNode> response = executeEmbedRequest(candidateModel, payload, headers, true);
        JsonNode embeddingsNode = response.getBody() == null ? null : response.getBody().path("embeddings");
        if (embeddingsNode != null && embeddingsNode.isArray() && !embeddingsNode.isEmpty()) {
          List<float[]> vectors = parseBatchEmbeddings(embeddingsNode);
          log.info("op=gemini_embedding_batch model={} size={} dim={}", candidateModel, vectors.size(), vectors.getFirst().length);
          return vectors;
        }
        throw new IllegalStateException("Gemini batch embedding response did not contain vectors.");
      } catch (RestClientResponseException exception) {
        if (shouldTryNextModel(exception)) {
          log.warn("op=gemini_embedding_batch model={} status={} fallback=true", candidateModel, exception.getStatusCode().value());
          continue;
        }
        throw new IllegalStateException("Gemini batch embedding failed: " + exception.getResponseBodyAsString(), exception);
      } catch (RuntimeException exception) {
        throw exception;
      }
    }

    throw new IllegalStateException("Gemini batch embedding failed for all candidate models.");
  }

  private List<float[]> parseBatchEmbeddings(JsonNode embeddingsNode) {
    List<float[]> vectors = new ArrayList<>(embeddingsNode.size());
    for (JsonNode embeddingNode : embeddingsNode) {
      JsonNode values = embeddingNode.path("values");
      if (!values.isArray() || values.isEmpty()) {
        throw new IllegalStateException("Gemini batch embedding contains empty vector.");
      }
      float[] vector = new float[values.size()];
      for (int i = 0; i < values.size(); i++) {
        vector[i] = (float) values.get(i).asDouble();
      }
      float[] normalized = normalize(vector);
      resolvedDimension.compareAndSet(0, normalized.length);
      vectors.add(normalized);
    }
    return vectors;
  }

  private JsonNode extractVectorValues(JsonNode body) {
    if (body == null) {
      return null;
    }

    JsonNode direct = body.path("embedding").path("values");
    if (direct.isArray() && !direct.isEmpty()) {
      return direct;
    }

    JsonNode list = body.path("embeddings");
    if (list.isArray() && !list.isEmpty()) {
      JsonNode first = list.get(0).path("values");
      if (first.isArray() && !first.isEmpty()) {
        return first;
      }
    }
    return null;
  }

  private Map<String, Object> buildEmbedRequest(String candidateModel, String text) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("model", "models/%s".formatted(candidateModel));
    payload.put("content", Map.of("parts", List.of(Map.of("text", text == null ? "" : text))));
    if (supportsOutputDimensionality(candidateModel)) {
      payload.put("outputDimensionality", resolveRequestedOutputDimensionality());
    }
    return payload;
  }

  private boolean supportsOutputDimensionality(String candidateModel) {
    return candidateModel != null && !candidateModel.endsWith("001");
  }

  private ResponseEntity<JsonNode> executeEmbedRequest(String candidateModel, Object payload, HttpHeaders headers, boolean batch) {
    String operation = batch ? "batchEmbedContents" : "embedContent";
    String endpoint = "%s/%s:%s".formatted(baseUrl, candidateModel, operation);
    for (int attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
      try {
        return restTemplate.exchange(
                endpoint, HttpMethod.POST, new HttpEntity<>(payload, headers), JsonNode.class);
      } catch (RestClientResponseException exception) {
        if (isRetryableRateLimit(exception) && attempt < DEFAULT_RETRY_ATTEMPTS) {
          long delayMillis = resolveRetryDelayMillis(exception, attempt);
          log.warn("op=gemini_embedding{} model={} status={} retry={}/{} delayMs={}", batch ? "_batch" : "", candidateModel, exception.getStatusCode().value(), attempt, DEFAULT_RETRY_ATTEMPTS, delayMillis);
          sleep(delayMillis);
          continue;
        }
        throw exception;
      }
    }
    throw new IllegalStateException("Gemini embedding request retry loop ended unexpectedly.");
  }

  private boolean isRetryableRateLimit(RestClientResponseException exception) {
    int statusCode = exception.getStatusCode().value();
    if (statusCode != 429 && statusCode != 503) {
      return false;
    }
    String response = exception.getResponseBodyAsString();
    return response == null || response.contains("\"RESOURCE_EXHAUSTED\"") || response.contains("\"UNAVAILABLE\"") || response.toLowerCase().contains("rate limit") || response.toLowerCase().contains("quota");
  }

  private long resolveRetryDelayMillis(RestClientResponseException exception, int attempt) {
    String response = exception.getResponseBodyAsString();
    if (response != null) {
      Matcher retryInfoMatcher = RETRY_DELAY_INFO_PATTERN.matcher(response);
      if (retryInfoMatcher.find()) {
        return Math.max(1000L, Long.parseLong(retryInfoMatcher.group(1)) * 1000L);
      }

      Matcher retrySecondsMatcher = RETRY_DELAY_SECONDS_PATTERN.matcher(response);
      if (retrySecondsMatcher.find()) {
        double seconds = Double.parseDouble(retrySecondsMatcher.group(1));
        return Math.max(1000L, (long) Math.ceil(seconds * 1000d));
      }
    }
    return DEFAULT_RETRY_DELAY_MILLIS * attempt;
  }

  private void sleep(long delayMillis) {
    try {
      Thread.sleep(delayMillis);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Embedding retry interrupted.", exception);
    }
  }

  private void validateApiKeyConfigured() {
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalStateException("Gemini API key is not configured.");
    }
  }

  private HttpHeaders buildHeaders() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("x-goog-api-key", apiKey);
    return headers;
  }

  private List<String> resolveCandidateModels() {
    Set<String> models = new LinkedHashSet<>();
    if (embeddingModel != null && !embeddingModel.isBlank()) {
      models.add(embeddingModel.trim());
    }
    if (embeddingFallbackModels != null && !embeddingFallbackModels.isBlank()) {
      for (String model : embeddingFallbackModels.split(",")) {
        String candidate = model.trim();
        if (!candidate.isBlank()) {
          models.add(candidate);
        }
      }
    }
    if (outputDimensionality > 0) {
      models.removeIf(model -> !supportsOutputDimensionality(model));
    }
    return new ArrayList<>(models);
  }

  private boolean shouldTryNextModel(RestClientResponseException exception) {
    int statusCode = exception.getStatusCode().value();
    if (statusCode == 404 || statusCode == 429 || statusCode == 503) {
      return true;
    }
    String response = exception.getResponseBodyAsString();
    if (response == null) {
      return false;
    }
    return response.contains("not found for API version") || response.contains("is not supported") || response.contains("\"UNAVAILABLE\"") || response.contains("\"RESOURCE_EXHAUSTED\"");
  }

  private float[] normalize(float[] vector) {
    double sumSquares = 0.0;
    for (float value : vector) {
      sumSquares += value * value;
    }

    double norm = Math.sqrt(sumSquares);
    if (norm == 0.0) {
      return vector;
    }

    float[] normalized = new float[vector.length];
    for (int i = 0; i < vector.length; i++) {
      normalized[i] = (float) (vector[i] / norm);
    }
    return normalized;
  }
}
