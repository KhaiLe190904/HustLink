package com.hustlink.backend.features.search.event;

import com.hustlink.backend.configuration.CacheConfigImproved.CacheEvictionHelper;
import com.hustlink.backend.features.search.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserProfileEventListener {
  private final SearchService searchService;
  private final CacheEvictionHelper cacheEvictionHelper;

  @Async
  @EventListener
  public void onUserProfileUpdated(UserProfileUpdatedEvent event) {
    searchService.indexUserProfile(event.getUser());
    cacheEvictionHelper.clearUserCache(event.getUser().getId());
  }
}
