package com.hustlink.backend.features.feed.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "feed.ranking")
public record FeedRankingProperties(
                                    @DefaultValue("5") int batchSize,
                                    @DefaultValue("50") int candidatePoolSize,
                                    @DefaultValue("150") int maxCandidatePoolSize,
                                    @DefaultValue("6") int freshWindowHours,
                                    @DefaultValue("50") double veryFreshPostScore,
                                    @DefaultValue("30") double authorAffinityScore,
                                    @DefaultValue("20") double engagementScore,
                                    @DefaultValue("3") int hotPostEngagementThreshold,
                                    @DefaultValue("24") int viewedWindowHours,
                                    @DefaultValue("100") double recentlyViewedPenalty,
                                    @DefaultValue("12") int servedWindowHours,
                                    @DefaultValue("30") double recentlyServedPenalty,
                                    @DefaultValue("50") double sameAuthorStreakPenalty,
                                    @DefaultValue("3") int fatigueThreshold,
                                    @DefaultValue("9999") double fatiguePenalty) {
}
