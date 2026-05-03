package com.hustlink.backend.features.networking.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.feed.repository.PostRepository;
import com.hustlink.backend.features.networking.dto.UserRecommendation;
import com.hustlink.backend.features.networking.dto.UserRecommendation.RecommendationReason;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import com.hustlink.backend.features.networking.repository.ConnectionRepository;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendationService {

  private final ConnectionRepository connectionRepository;
  private final UserRepository userRepository;
  private final PostRepository postRepository;

  // Weights for ML scoring (tunable hyperparameters)
  private static final double SECOND_DEGREE_WEIGHT = 5.0;
  private static final double MUTUAL_CONNECTION_WEIGHT = 0.8;
  private static final double COMPANY_MATCH_WEIGHT = 3.5;
  private static final double POSITION_MATCH_WEIGHT = 2.5;
  private static final double LOCATION_MATCH_WEIGHT = 1.8;
  private static final double ACTIVITY_SIMILARITY_WEIGHT = 2.0;
  private static final double PROFILE_COMPLETE_BONUS = 1.5;
  private static final double RECENT_ACTIVITY_BONUS = 1.0;
  private static final int DEFAULT_LIMIT = 20;
  private static final int MAX_LIMIT = 50;
  private static final int CANDIDATE_POOL_SIZE = 500;

  @Transactional(readOnly = true)
  public List<UserRecommendation> getRecommendations(User user, int limit) {
    int normalizedLimit = Math.max(1, Math.min(limit <= 0 ? DEFAULT_LIMIT : limit, MAX_LIMIT));
    List<UserRecommendation> rankedRecommendations = getRankedRecommendations(user);
    if (rankedRecommendations.isEmpty()) {
      return List.of();
    }
    return rankedRecommendations.stream().limit(normalizedLimit).collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  @Cacheable(value = "userRecommendations", key = "#user.id")
  public List<UserRecommendation> getRankedRecommendations(User user) {
    log.info("Computing ranked recommendations for user {}", user.getId());

    Set<Long> connectedUserIds = getConnectedUserIds(user);
    Set<Long> connectedAndPendingUserIds = getConnectedAndPendingUserIds(user);
    connectedAndPendingUserIds.add(user.getId());

    Set<User> secondDegreeConnections = getSecondDegreeConnections(user, connectedUserIds);

    Set<User> candidates = new HashSet<>(secondDegreeConnections);
    if (candidates.size() < CANDIDATE_POOL_SIZE) {
      List<User> additionalUsers = userRepository.findRandomCompleteProfiles(
              new ArrayList<>(connectedAndPendingUserIds), CANDIDATE_POOL_SIZE);
      candidates.addAll(additionalUsers);
    }

    candidates.removeIf(candidate -> connectedAndPendingUserIds.contains(candidate.getId()));

    List<UserRecommendation> recommendations = new ArrayList<>();
    Map<Long, Integer> userActivityScores = getUserActivityScores(user);

    for (User candidate : candidates) {
      if (!candidate.getProfileComplete()) {
        continue;
      }

      UserFeatures features = extractFeatures(user, candidate, secondDegreeConnections, connectedUserIds, userActivityScores);
      double score = calculateMLScore(features);

      RecommendationReason reasons = RecommendationReason.builder().mutualConnections(features.mutualConnections).sameCompany(features.sameCompany).samePosition(features.samePosition).sameLocation(features.sameLocation).isSecondDegreeConnection(features.isSecondDegree).activitySimilarity(features.activitySimilarity).build();

      recommendations.add(UserRecommendation.builder().user(candidate).score(score).reasons(reasons).build());
    }

    return recommendations.stream().sorted((r1, r2) -> {
      int scoreComparison = Double.compare(r2.getScore(), r1.getScore());
      if (scoreComparison != 0) {
        return scoreComparison;
      }
      return Long.compare(r1.getUser().getId(), r2.getUser().getId());
    }).collect(Collectors.toList());
  }

  private UserFeatures extractFeatures(User user, User candidate, Set<User> secondDegreeConnections, Set<Long> connectedUserIds, Map<Long, Integer> userActivityScores) {
    UserFeatures features = new UserFeatures();

    features.isSecondDegree = secondDegreeConnections.contains(candidate);
    features.sameCompany = isSimilar(user.getCompany(), candidate.getCompany());
    features.samePosition = isSimilar(user.getPosition(), candidate.getPosition());
    features.sameLocation = isSameLocation(user, candidate);
    features.mutualConnections = countMutualConnections(user, candidate, connectedUserIds);

    Integer userActivity = userActivityScores.getOrDefault(user.getId(), 0);
    Integer candidateActivity = userActivityScores.getOrDefault(candidate.getId(), 0);
    features.activitySimilarity = calculateActivitySimilarity(userActivity, candidateActivity);
    features.profileComplete = candidate.getProfileComplete();
    features.hasRecentActivity = hasRecentActivity(candidate);

    return features;
  }

  private double calculateMLScore(UserFeatures features) {
    double score = 0.0;

    if (features.isSecondDegree) {
      score += SECOND_DEGREE_WEIGHT;
    }
    if (features.sameCompany) {
      score += COMPANY_MATCH_WEIGHT;
    }
    if (features.samePosition) {
      score += POSITION_MATCH_WEIGHT;
    }
    if (features.sameLocation) {
      score += LOCATION_MATCH_WEIGHT;
    }

    score += features.mutualConnections * MUTUAL_CONNECTION_WEIGHT;
    score += features.activitySimilarity * ACTIVITY_SIMILARITY_WEIGHT;

    if (features.profileComplete) {
      score += PROFILE_COMPLETE_BONUS;
    }
    if (features.hasRecentActivity) {
      score += RECENT_ACTIVITY_BONUS;
    }

    return score;
  }

  private Set<Long> getConnectedUserIds(User user) {
    List<Connection> connections = connectionRepository.findAllConnectionsByUser(user.getId());

    return connections.stream().flatMap(conn -> {
      List<Long> ids = new ArrayList<>();
      if (!conn.getAuthor().getId().equals(user.getId())) {
        ids.add(conn.getAuthor().getId());
      }
      if (!conn.getRecipient().getId().equals(user.getId())) {
        ids.add(conn.getRecipient().getId());
      }
      return ids.stream();
    }).collect(Collectors.toSet());
  }

  private Set<Long> getConnectedAndPendingUserIds(User user) {
    List<Connection> connections = connectionRepository.findAllConnectionsAndPendingByUser(user.getId());

    return connections.stream().flatMap(conn -> {
      List<Long> ids = new ArrayList<>();
      if (!conn.getAuthor().getId().equals(user.getId())) {
        ids.add(conn.getAuthor().getId());
      }
      if (!conn.getRecipient().getId().equals(user.getId())) {
        ids.add(conn.getRecipient().getId());
      }
      return ids.stream();
    }).collect(Collectors.toSet());
  }

  private Set<User> getSecondDegreeConnections(User user, Set<Long> directConnectionIds) {
    if (directConnectionIds.isEmpty()) {
      return new HashSet<>();
    }

    List<Connection> secondDegreeConns = connectionRepository.findSecondDegreeConnections(new ArrayList<>(directConnectionIds), Status.ACCEPTED);

    Set<User> secondDegree = new HashSet<>();
    for (Connection conn : secondDegreeConns) {
      if (!conn.getAuthor().getId().equals(user.getId()) && !directConnectionIds.contains(conn.getAuthor().getId())) {
        secondDegree.add(conn.getAuthor());
      }
      if (!conn.getRecipient().getId().equals(user.getId()) && !directConnectionIds.contains(conn.getRecipient().getId())) {
        secondDegree.add(conn.getRecipient());
      }
    }

    return secondDegree;
  }

  private int countMutualConnections(User user1, User user2, Set<Long> user1ConnectionIds) {
    Set<Long> user2ConnectionIds = getConnectedUserIds(user2);
    Set<Long> intersection = new HashSet<>(user1ConnectionIds);
    intersection.retainAll(user2ConnectionIds);
    return intersection.size();
  }

  private double calculateActivitySimilarity(int activity1, int activity2) {
    if (activity1 == 0 && activity2 == 0) {
      return 0.5; // Both inactive
    }
    int maxActivity = Math.max(activity1, activity2);
    int minActivity = Math.min(activity1, activity2);
    return maxActivity == 0 ? 0 : (double) minActivity / maxActivity;
  }

  private Map<Long, Integer> getUserActivityScores(User user) {
    LocalDateTime thirtyDaysAgo = LocalDateTime.now().minus(30, ChronoUnit.DAYS);
    List<Object[]> results = postRepository.countPostsByAuthorSince(thirtyDaysAgo);

    return results.stream().collect(Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).intValue()));
  }

  private boolean hasRecentActivity(User user) {
    LocalDateTime sevenDaysAgo = LocalDateTime.now().minus(7, ChronoUnit.DAYS);
    return postRepository.hasRecentPosts(user.getId(), sevenDaysAgo);
  }

  private boolean isSimilar(String str1, String str2) {
    if (str1 == null || str2 == null) {
      return false;
    }
    return str1.trim().equalsIgnoreCase(str2.trim());
  }

  private boolean isSameLocation(User user, User candidate) {
    String userLocation = user.getLocationForMatching();
    String candidateLocation = candidate.getLocationForMatching();
    if (userLocation.isBlank() || candidateLocation.isBlank()) {
      return false;
    }
    return userLocation.equals(candidateLocation);
  }

  private static class UserFeatures {
    boolean isSecondDegree;
    boolean sameCompany;
    boolean samePosition;
    boolean sameLocation;
    int mutualConnections;
    double activitySimilarity;
    boolean profileComplete;
    boolean hasRecentActivity;
  }
}
