package com.hustlink.backend.configuration;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@EnableCaching
public class CacheConfigImproved {

  @Bean
  @Profile("!caffeine")
  public CacheManager simpleCacheManager() {
    return new ConcurrentMapCacheManager("userRecommendations");
  }

  public static class CacheEvictionHelper {
    private final CacheManager cacheManager;

    public CacheEvictionHelper(CacheManager cacheManager) {
      this.cacheManager = cacheManager;
    }

    public void clearUserCache(Long userId) {
      var cache = cacheManager.getCache("userRecommendations");
      if (cache != null) {
        cache.evict(userId + "_2");
        cache.evict(userId + "_10");
        cache.evict(userId + "_20");
        cache.evict(userId + "_50");
      }
    }

    public void clearAllCache() {
      var cache = cacheManager.getCache("userRecommendations");
      if (cache != null) {
        cache.clear();
      }
    }
  }

  @Bean
  public CacheEvictionHelper cacheEvictionHelper(CacheManager cacheManager) {
    return new CacheEvictionHelper(cacheManager);
  }
}
