package com.hustlink.backend.features.ai.embedding;

import com.hustlink.backend.features.ai.embedding.dto.SimilarPoint;
import java.util.List;
import java.util.Map;

public interface VectorStoreClient {
  void upsert(String collection, String id, float[] vector, Map<String, Object> payload);

  List<SimilarPoint> search(String collection, float[] queryVector, int topK, Map<String, Object> filter);

  void delete(String collection, String id);

  void ensureCollection(String collection, int dim);

  void deleteCollection(String collection);
}
