package com.hustlink.backend.features.ai.embedding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.dto.SimilarPoint;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Component
@Slf4j
@RequiredArgsConstructor
public class QdrantVectorStoreClient implements VectorStoreClient {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
  };

  private final RestTemplate restTemplate;
  private final ObjectMapper objectMapper;

  @Value("${qdrant.url:http://localhost:6333}")
  private String qdrantUrl;

  @Value("${qdrant.api-key:}")
  private String apiKey;

  private final Set<String> knownCollections = ConcurrentHashMap.newKeySet();

  @Override
  public void upsert(String collection, String id, float[] vector, Map<String, Object> payload) {
    ensureCollection(collection, vector.length);
    Object finalId = id;
    if (id != null && id.matches("\\d+")) {
      try {
        finalId = Long.parseLong(id);
      } catch (NumberFormatException e) {
        // fallback to string if parsing fails
      }
    }
    Map<String, Object> point = Map.of(
            "id", finalId, "vector", toList(vector), "payload", payload == null ? Map.of() : payload);
    Map<String, Object> body = Map.of("points", List.of(point));
    exchange("/collections/%s/points?wait=true".formatted(collection), HttpMethod.PUT, body, JsonNode.class);
    log.info("op=qdrant_upsert collection={} id={}", collection, id);
  }

  @Override
  public List<SimilarPoint> search(String collection, float[] queryVector, int topK, Map<String, Object> filter) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("vector", toList(queryVector));
    body.put("limit", topK);
    body.put("with_payload", true);
    Map<String, Object> qdrantFilter = toQdrantFilter(filter);
    if (!qdrantFilter.isEmpty()) {
      body.put("filter", qdrantFilter);
    }

    ResponseEntity<JsonNode> response = exchange(
            "/collections/%s/points/search".formatted(collection), HttpMethod.POST, body, JsonNode.class);
    JsonNode results = response.getBody() == null ? null : response.getBody().path("result");
    if (results == null || !results.isArray()) {
      return List.of();
    }

    List<SimilarPoint> points = new ArrayList<>();
    for (JsonNode node : results) {
      Map<String, Object> payload = objectMapper.convertValue(node.path("payload"), MAP_TYPE);
      points.add(new SimilarPoint(node.path("id").asText(), node.path("score").asDouble(), payload));
    }
    log.info("op=qdrant_search collection={} results={}", collection, points.size());
    return points;
  }

  @Override
  public void delete(String collection, String id) {
    Object finalId = id;
    if (id != null && id.matches("\\d+")) {
      try {
        finalId = Long.parseLong(id);
      } catch (NumberFormatException e) {
        // fallback
      }
    }
    Map<String, Object> body = Map.of("points", List.of(finalId));
    exchange("/collections/%s/points/delete?wait=true".formatted(collection), HttpMethod.POST, body, JsonNode.class);
    log.info("op=qdrant_delete collection={} id={}", collection, id);
  }

  @Override
  public void ensureCollection(String collection, int dim) {
    if (knownCollections.contains(collection)) {
      return;
    }
    try {
      exchange("/collections/%s".formatted(collection), HttpMethod.GET, null, JsonNode.class);
      knownCollections.add(collection);
      return;
    } catch (RestClientResponseException exception) {
      if (exception.getStatusCode().value() != 404) {
        throw exception;
      }
    }

    Map<String, Object> body = Map.of(
            "vectors", Map.of(
                    "size", dim, "distance", "Cosine"));
    exchange("/collections/%s".formatted(collection), HttpMethod.PUT, body, JsonNode.class);
    knownCollections.add(collection);
    log.info("op=qdrant_collection_created collection={} dim={}", collection, dim);
  }

  @Override
  public void deleteCollection(String collection) {
    try {
      exchange("/collections/%s".formatted(collection), HttpMethod.DELETE, null, JsonNode.class);
      knownCollections.remove(collection);
      log.info("op=qdrant_collection_deleted collection={}", collection);
    } catch (RestClientResponseException exception) {
      knownCollections.remove(collection);
      if (exception.getStatusCode().value() == 404) {
        log.info("op=qdrant_collection_delete_skipped collection={} reason=not_found", collection);
        return;
      }
      throw exception;
    }
  }

  private <T> ResponseEntity<T> exchange(String path, HttpMethod method, Object body, Class<T> responseType) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (apiKey != null && !apiKey.isBlank()) {
      headers.set("api-key", apiKey);
    }
    HttpEntity<Object> request = new HttpEntity<>(body, headers);
    return restTemplate.exchange(qdrantUrl + path, method, request, responseType);
  }

  private Map<String, Object> toQdrantFilter(Map<String, Object> filter) {
    if (filter == null || filter.isEmpty()) {
      return Map.of();
    }

    List<Map<String, Object>> must = new ArrayList<>();
    filter.forEach((key, value) -> {
      if (value != null) {
        must.add(Map.of("key", key, "match", Map.of("value", value)));
      }
    });
    return must.isEmpty() ? Map.of() : Map.of("must", must);
  }

  private List<Float> toList(float[] vector) {
    List<Float> values = new ArrayList<>(vector.length);
    for (float value : vector) {
      values.add(value);
    }
    return values;
  }
}
