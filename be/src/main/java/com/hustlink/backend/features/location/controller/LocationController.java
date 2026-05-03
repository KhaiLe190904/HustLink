package com.hustlink.backend.features.location.controller;

import com.hustlink.backend.features.location.dto.LocationSuggestionDto;
import com.hustlink.backend.features.location.service.LocationSearchService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/locations")
public class LocationController {
  private final LocationSearchService locationSearchService;

  @GetMapping("/search")
  public List<LocationSuggestionDto> search(
                                            @RequestParam String query, @RequestParam(required = false, defaultValue = "5") Integer limit) {
    return locationSearchService.searchLocations(query, limit == null ? 5 : limit);
  }
}
