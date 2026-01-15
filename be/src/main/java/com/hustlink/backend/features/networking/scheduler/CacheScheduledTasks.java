package com.hustlink.backend.features.networking.scheduler;

import com.hustlink.backend.configuration.CacheConfigImproved.CacheEvictionHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CacheScheduledTasks {

  private final CacheEvictionHelper cacheEvictionHelper;

  @Scheduled(cron = "0 0 2 * * *")
  public void clearCacheNightly() {
    log.info("Starting nightly cache cleanup...");
    cacheEvictionHelper.clearAllCache();
    log.info("Nightly cache cleanup completed");
  }
}
