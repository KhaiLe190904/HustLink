package com.hustlink.backend.features.search.service;

import com.hustlink.backend.features.ai.embedding.EmbeddingService;
import com.hustlink.backend.features.ai.embedding.VectorStoreClient;
import com.hustlink.backend.features.ai.embedding.dto.SimilarPoint;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.search.mapper.orm.Search;
import org.hibernate.search.mapper.orm.session.SearchSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SearchService {
  private static final Logger log = LoggerFactory.getLogger(SearchService.class);
  private static final String USER_PROFILE_COLLECTION = "user_profile";

  private final EntityManager entityManager;
  private final UserRepository userRepository;
  private final EmbeddingService embeddingService;
  private final VectorStoreClient vectorStoreClient;

  public SearchService(
                       EntityManager entityManager, UserRepository userRepository, EmbeddingService embeddingService, VectorStoreClient vectorStoreClient) {
    this.entityManager = entityManager;
    this.userRepository = userRepository;
    this.embeddingService = embeddingService;
    this.vectorStoreClient = vectorStoreClient;
  }

  public String buildUserIndexText(User user) {
    StringBuilder sb = new StringBuilder();
    sb.append(user.getFirstName() == null ? "" : user.getFirstName()).append(" ").append(user.getLastName() == null ? "" : user.getLastName());

    if (user.getPosition() != null && !user.getPosition().isBlank()) {
      sb.append(" | Role: ").append(user.getPosition().trim());
    }
    if (user.getCompany() != null && !user.getCompany().isBlank()) {
      sb.append(" | Company: ").append(user.getCompany().trim());
    }
    if (user.getAbout() != null && !user.getAbout().isBlank()) {
      sb.append(" | About: ").append(user.getAbout().trim());
    }
    if (user.getExperience() != null && !user.getExperience().isBlank()) {
      sb.append(" | Experience: ").append(user.getExperience().trim());
    }
    if (user.getEducation() != null && !user.getEducation().isBlank()) {
      sb.append(" | Education: ").append(user.getEducation().trim());
    }
    return sb.toString().trim();
  }

  public void indexUserProfile(User user) {
    if (user == null) {
      return;
    }
    if (!Boolean.TRUE.equals(user.getProfileComplete())) {
      try {
        vectorStoreClient.delete(USER_PROFILE_COLLECTION, user.getId().toString());
        log.info("op=index_user_profile action=delete user_id={} reason=profile_incomplete", user.getId());
      } catch (Exception e) {
        // ignore if not found
        log.warn("op=index_user_profile action=delete_failed user_id={} error={}", user.getId(), e.getMessage());
      }
      return;
    }

    String indexText = buildUserIndexText(user);
    float[] vector = embeddingService.embed(indexText);

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("userId", user.getId());
    payload.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
    payload.put("lastName", user.getLastName() == null ? "" : user.getLastName());
    payload.put("position", user.getPosition() == null ? "" : user.getPosition());
    payload.put("company", user.getCompany() == null ? "" : user.getCompany());
    payload.put("role", user.getRole().name());

    vectorStoreClient.upsert(USER_PROFILE_COLLECTION, user.getId().toString(), vector, payload);
    log.info("op=index_user_profile action=upsert user_id={}", user.getId());
  }

  private void indexUserProfilesBatch(List<User> users) {
    if (users == null || users.isEmpty()) {
      return;
    }

    List<String> indexTexts = users.stream().map(this::buildUserIndexText).toList();

    List<float[]> vectors = embeddingService.embedBatch(indexTexts);
    if (vectors.size() != users.size()) {
      throw new IllegalStateException("Mismatch between users and returned embedding vectors.");
    }

    for (int i = 0; i < users.size(); i++) {
      User user = users.get(i);
      float[] vector = vectors.get(i);

      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("userId", user.getId());
      payload.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
      payload.put("lastName", user.getLastName() == null ? "" : user.getLastName());
      payload.put("position", user.getPosition() == null ? "" : user.getPosition());
      payload.put("company", user.getCompany() == null ? "" : user.getCompany());
      payload.put("role", user.getRole().name());

      vectorStoreClient.upsert(USER_PROFILE_COLLECTION, user.getId().toString(), vector, payload);
    }
    log.info("op=index_user_profiles_batch count={}", users.size());
  }

  public void reindexAllUserProfiles() {
    List<User> users = userRepository.findAll();
    List<User> completeUsers = users.stream().filter(user -> Boolean.TRUE.equals(user.getProfileComplete())).toList();

    log.info("op=reindex_all_user_profiles total_users={} complete_users={}", users.size(), completeUsers.size());

    try {
      vectorStoreClient.deleteCollection(USER_PROFILE_COLLECTION);
    } catch (Exception e) {
      // ignore if not found
    }
    vectorStoreClient.ensureCollection(USER_PROFILE_COLLECTION, embeddingService.dimension());

    int batchSize = 50;
    for (int start = 0; start < completeUsers.size(); start += batchSize) {
      int end = Math.min(start + batchSize, completeUsers.size());
      List<User> batch = completeUsers.subList(start, end);
      indexUserProfilesBatch(batch);

      if (end < completeUsers.size()) {
        try {
          Thread.sleep(1500);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          throw new IllegalStateException("Reindex user profiles sleep interrupted", e);
        }
      }
    }

    // Đồng thời xây dựng lại Lucene index để đồng bộ hóa hoàn toàn cho BM25
    try {
      log.info("op=reindex_all_user_profiles action=lucene_mass_indexer_started");
      SearchSession searchSession = Search.session(entityManager);
      searchSession.massIndexer(User.class).startAndWait();
      log.info("op=reindex_all_user_profiles action=lucene_mass_indexer_success");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      log.error("op=reindex_all_user_profiles action=lucene_mass_indexer_interrupted error={}", e.getMessage());
    } catch (Exception e) {
      log.error("op=reindex_all_user_profiles action=lucene_mass_indexer_failed error={}", e.getMessage());
    }
  }

  @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
  public void initLuceneIndex() {
    log.info("op=init_lucene_index action=started");
    try {
      SearchSession searchSession = Search.session(entityManager);
      searchSession.massIndexer(User.class).startAndWait();
      log.info("op=init_lucene_index action=success");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      log.warn("op=init_lucene_index action=interrupted error={}", e.getMessage());
    } catch (Exception e) {
      log.error("op=init_lucene_index action=failed error={}", e.getMessage());
    }
  }

  public List<User> searchUsers(String query) {
    return searchUsers(query, "bm25");
  }

  public List<User> searchUsers(String query, String mode) {
    if ("bm25".equalsIgnoreCase(mode)) {
      return searchUsersBM25(query);
    } else if ("semantic".equalsIgnoreCase(mode)) {
      return searchUsersSemantic(query, 20);
    } else {
      return searchUsersHybrid(query, 20);
    }
  }

  public List<User> searchUsersBM25(String query) {
    if (query == null || query.isBlank()) {
      return List.of();
    }
    try {
      SearchSession searchSession = Search.session(entityManager);
      return searchSession.search(User.class).where(f -> f.match().fields("firstName", "lastName", "position", "company").matching(query).fuzzy(2)).fetchAllHits();
    } catch (Exception e) {
      log.warn("op=search_users_bm25 status=failed error={}", e.getMessage());
      try {
        String lowerQuery = query.toLowerCase();
        return userRepository.findAll().stream().filter(user -> Boolean.TRUE.equals(user.getProfileComplete())).filter(user -> {
          return (user.getFirstName() != null && user.getFirstName().toLowerCase().contains(lowerQuery)) || (user.getLastName() != null && user.getLastName().toLowerCase().contains(lowerQuery)) || (user.getPosition() != null && user.getPosition().toLowerCase().contains(lowerQuery)) || (user.getCompany() != null && user.getCompany().toLowerCase().contains(lowerQuery));
        }).toList();
      } catch (Exception ex) {
        log.error("op=search_users_bm25_fallback status=error error={}", ex.getMessage());
        return List.of();
      }
    }
  }

  public List<User> searchUsersSemantic(String query, int topK) {
    if (query == null || query.isBlank()) {
      return List.of();
    }
    float[] queryVector = embeddingService.embed(query);
    List<SimilarPoint> points = vectorStoreClient.search(USER_PROFILE_COLLECTION, queryVector, topK, Map.of());

    List<Long> ids = points.stream().map(point -> {
      try {
        return Long.parseLong(point.id());
      } catch (NumberFormatException e) {
        return null;
      }
    }).filter(Objects::nonNull).toList();

    if (ids.isEmpty()) {
      return List.of();
    }

    List<User> users = userRepository.findAllById(ids);
    Map<Long, User> userMap = users.stream().collect(Collectors.toMap(User::getId, u -> u));
    return ids.stream().map(userMap::get).filter(Objects::nonNull).toList();
  }

  public List<User> searchUsersHybrid(String query, int topK) {
    if (query == null || query.isBlank()) {
      return List.of();
    }
    List<User> bm25Results = searchUsersBM25(query);
    List<User> semanticResults = searchUsersSemantic(query, topK * 2);

    Map<Long, Double> rrfScores = new HashMap<>();
    int k = 60;

    for (int i = 0; i < bm25Results.size(); i++) {
      User user = bm25Results.get(i);
      rrfScores.put(user.getId(), rrfScores.getOrDefault(user.getId(), 0.0) + 1.0 / (k + i + 1));
    }

    for (int i = 0; i < semanticResults.size(); i++) {
      User user = semanticResults.get(i);
      rrfScores.put(user.getId(), rrfScores.getOrDefault(user.getId(), 0.0) + 1.0 / (k + i + 1));
    }

    List<Long> sortedIds = rrfScores.entrySet().stream().sorted(Map.Entry.<Long, Double>comparingByValue().reversed()).limit(topK).map(Map.Entry::getKey).toList();

    if (sortedIds.isEmpty()) {
      return List.of();
    }

    List<User> users = userRepository.findAllById(sortedIds);
    Map<Long, User> userMap = users.stream().collect(Collectors.toMap(User::getId, u -> u));
    return sortedIds.stream().map(userMap::get).filter(Objects::nonNull).toList();
  }
}
