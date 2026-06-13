package com.hustlink.backend.features.networking.dto;

import com.hustlink.backend.features.authentication.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserRecommendation {
  private User user;
  private double score;
  private RecommendationReason reasons;

  @Data
  @Builder
  @AllArgsConstructor
  @NoArgsConstructor
  public static class RecommendationReason {
    private int mutualConnections;
    private boolean sameCompany;
    private boolean samePosition;
    private boolean sameLocation;
    private boolean isSecondDegreeConnection;
    private double activitySimilarity;
    @Builder.Default
    private double semanticSimilarity = 0.0;
  }

  public static UserRecommendation of(User user, double score) {
    return UserRecommendation.builder().user(user).score(score).build();
  }
}
