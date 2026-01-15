package com.hustlink.backend.features.networking.controller;

import com.hustlink.backend.configuration.CacheConfigImproved.CacheEvictionHelper;
import com.hustlink.backend.features.authentication.model.User;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCache;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cache")
@RequiredArgsConstructor
public class CacheMonitoringController {

  private final CacheManager cacheManager;
  private final CacheEvictionHelper cacheEvictionHelper;

  @GetMapping("/stats")
  public ResponseEntity<Map<String, Object>> getCacheStats(@RequestAttribute("authenticationUser") User user) {
    Cache cache = cacheManager.getCache("userRecommendations");

    Map<String, Object> stats = new HashMap<>();

    if (cache instanceof ConcurrentMapCache) {
      ConcurrentMapCache mapCache = (ConcurrentMapCache) cache;
      var nativeCache = mapCache.getNativeCache();

      stats.put("cacheType", "ConcurrentMapCache");
      stats.put("size", nativeCache.size());
      stats.put("keys", nativeCache.keySet());
      stats.put("hasTimeToLive", false);
      stats.put("hasSizeLimit", false);
    }

    return ResponseEntity.ok(stats);
  }

  @PostMapping("/clear")
  public ResponseEntity<Map<String, String>> clearCache(@RequestAttribute("authenticationUser") User user) {
    cacheEvictionHelper.clearAllCache();
    return ResponseEntity.ok(Map.of("status", "success", "message", "Cache cleared"));
  }

  @PostMapping("/clear/user/{userId}")
  public ResponseEntity<Map<String, String>> clearUserCache(@RequestAttribute("authenticationUser") User user, @PathVariable Long userId) {
    cacheEvictionHelper.clearUserCache(userId);
    return ResponseEntity.ok(Map.of("status", "success", "message", "User cache cleared for userId: " + userId));
  }
}
