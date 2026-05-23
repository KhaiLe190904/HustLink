package com.hustlink.backend.features.ai.embedding;

import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/infra")
@RequireRole(UserRole.ADMIN)
@RequiredArgsConstructor
public class VectorStoreAdminController {
  private static final String INTERVIEW_QUESTION_BANK_COLLECTION = "interview_question_bank";
  private static final List<String> COLLECTIONS = List.of(
          INTERVIEW_QUESTION_BANK_COLLECTION, "user_profile", "job_description", "cv_document", "learning_resource");

  private final EmbeddingService embeddingService;
  private final VectorStoreClient vectorStoreClient;

  @PostMapping("/init-vector-store")
  public VectorStoreInitResponse initVectorStore() {
    COLLECTIONS.forEach(collection -> vectorStoreClient.ensureCollection(collection, embeddingService.dimension()));
    return new VectorStoreInitResponse(COLLECTIONS, embeddingService.dimension());
  }

  @PostMapping("/reset-interview-question-bank")
  public VectorStoreResetResponse resetInterviewQuestionBank() {
    vectorStoreClient.deleteCollection(INTERVIEW_QUESTION_BANK_COLLECTION);
    vectorStoreClient.ensureCollection(INTERVIEW_QUESTION_BANK_COLLECTION, embeddingService.dimension());
    return new VectorStoreResetResponse(
            INTERVIEW_QUESTION_BANK_COLLECTION, embeddingService.dimension(), "Collection cleared and recreated. Import or reindex only when you are ready to spend embedding tokens again.");
  }

  public record VectorStoreInitResponse(List<String> collections, int dimension) {
  }

  public record VectorStoreResetResponse(String collection, int dimension, String message) {
  }
}
