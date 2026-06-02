package com.hustlink.backend.features.search.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import com.hustlink.backend.features.search.service.SearchService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {
  private final SearchService searchService;

  public SearchController(SearchService searchService) {
    this.searchService = searchService;
  }

  @GetMapping("/users")
  public List<User> searchUsers(
                                @RequestParam String query, @RequestParam(required = false, defaultValue = "bm25") String mode) {
    return searchService.searchUsers(query, mode);
  }

  @PostMapping("/admin/reindex")
  @RequireRole(UserRole.ADMIN)
  public Map<String, String> reindexUserProfiles() {
    searchService.reindexAllUserProfiles();
    return Map.of("message", "User profiles reindexed successfully.");
  }
}
