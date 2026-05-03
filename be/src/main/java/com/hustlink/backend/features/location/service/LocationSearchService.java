package com.hustlink.backend.features.location.service;

import com.hustlink.backend.features.location.dto.LocationSuggestionDto;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationSearchService {
  private static final int DEFAULT_LIMIT = 5;
  private static final int MAX_LIMIT = 20;
  private static final List<String> FALLBACK_LOCATIONS = Arrays.asList(
          "An Giang, Vietnam", "Ba Ria - Vung Tau, Vietnam", "Bac Giang, Vietnam", "Bac Kan, Vietnam",
          "Bac Lieu, Vietnam", "Bac Ninh, Vietnam", "Ben Tre, Vietnam", "Binh Dinh, Vietnam",
          "Binh Duong, Vietnam", "Binh Phuoc, Vietnam", "Binh Thuan, Vietnam", "Ca Mau, Vietnam",
          "Can Tho, Vietnam", "Cao Bang, Vietnam", "Da Nang, Vietnam", "Dak Lak, Vietnam",
          "Dak Nong, Vietnam", "Dien Bien, Vietnam", "Dong Nai, Vietnam", "Dong Thap, Vietnam",
          "Gia Lai, Vietnam", "Ha Giang, Vietnam", "Ha Nam, Vietnam", "Ha Noi, Vietnam",
          "Ha Tinh, Vietnam", "Hai Duong, Vietnam", "Hai Phong, Vietnam", "Hau Giang, Vietnam",
          "Ho Chi Minh City, Vietnam", "Hoa Binh, Vietnam", "Hung Yen, Vietnam", "Khanh Hoa, Vietnam",
          "Kien Giang, Vietnam", "Kon Tum, Vietnam", "Lai Chau, Vietnam", "Lam Dong, Vietnam",
          "Lang Son, Vietnam", "Lao Cai, Vietnam", "Long An, Vietnam", "Nam Dinh, Vietnam",
          "Nghe An, Vietnam", "Ninh Binh, Vietnam", "Ninh Thuan, Vietnam", "Phu Tho, Vietnam",
          "Phu Yen, Vietnam", "Quang Binh, Vietnam", "Quang Nam, Vietnam", "Quang Ngai, Vietnam",
          "Quang Ninh, Vietnam", "Quang Tri, Vietnam", "Soc Trang, Vietnam", "Son La, Vietnam",
          "Tay Ninh, Vietnam", "Thai Binh, Vietnam", "Thai Nguyen, Vietnam", "Thanh Hoa, Vietnam",
          "Thua Thien Hue, Vietnam", "Tien Giang, Vietnam", "Tra Vinh, Vietnam", "Tuyen Quang, Vietnam",
          "Vinh Long, Vietnam", "Vinh Phuc, Vietnam", "Yen Bai, Vietnam",
          "San Francisco, US", "New York, US", "Seattle, US", "Boston, US", "Austin, US",
          "London, UK", "Berlin, DE", "Paris, FR", "Amsterdam, NL", "Stockholm, SE",
          "Tokyo, JP", "Singapore, SG", "Sydney, AU", "Toronto, CA", "Vancouver, CA",
          "Dubai, AE", "Dakar, SN", "Seoul, KR", "Mumbai, IN", "Shanghai, CN",
          "Sao Paulo, BR", "Mexico City, MX", "Dublin, IE");

  private final RestTemplate restTemplate;

  public List<LocationSuggestionDto> searchLocations(String query, int limit) {
    String trimmed = query == null ? "" : query.trim();
    if (trimmed.length() < 2) {
      return List.of();
    }
    int normalizedLimit = normalizeLimit(limit);

    try {
      int remoteLimit = Math.min(Math.max(normalizedLimit * 4, 10), 40);
      List<Map<String, Object>> primaryResults = searchRemote(trimmed, remoteLimit);
      List<LocationSuggestionDto> remoteSuggestions = primaryResults.stream()
              .filter(location -> !isCountryLevel(location))
              .map(this::toSuggestion)
              .filter(suggestion -> suggestion.getLocationDisplay() != null && !suggestion.getLocationDisplay().isBlank())
              .collect(Collectors.toMap(
                      suggestion -> suggestion.getLocationKey() + "::" + suggestion.getLocationDisplay().toLowerCase(Locale.ROOT),
                      suggestion -> suggestion,
                      (first, ignored) -> first))
              .values()
              .stream()
              .collect(Collectors.toList());

      List<LocationSuggestionDto> fallbackSuggestions = fallbackSuggestions(trimmed, normalizedLimit * 2);
      List<LocationSuggestionDto> suggestions = java.util.stream.Stream
              .concat(remoteSuggestions.stream(), fallbackSuggestions.stream())
              .collect(Collectors.toMap(
                      suggestion -> suggestion.getLocationKey() + "::" + suggestion.getLocationDisplay().toLowerCase(Locale.ROOT),
                      suggestion -> suggestion,
                      (first, ignored) -> first))
              .values()
              .stream()
              .limit(normalizedLimit)
              .collect(Collectors.toList());

      if (suggestions.isEmpty()) {
        return fallbackSuggestions(trimmed, normalizedLimit);
      }
      return suggestions;
    } catch (Exception exception) {
      log.warn("Location search failed, fallback to local list. {}", exception.getMessage());
      return fallbackSuggestions(trimmed, normalizedLimit);
    }
  }

  private List<Map<String, Object>> searchRemote(String query, int limit) {
    String encodedQuery = UriUtils.encodeQueryParam(query, StandardCharsets.UTF_8);
    String url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=0&accept-language=en&dedupe=1&limit="
            + limit + "&q=" + encodedQuery;

    HttpHeaders headers = new HttpHeaders();
    headers.add("User-Agent", "HustLink/1.0 (location-autocomplete)");
    HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

    ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
            url,
            HttpMethod.GET,
            requestEntity,
            new ParameterizedTypeReference<>() {
            });
    List<Map<String, Object>> body = response.getBody();
    return body == null ? List.of() : body;
  }

  private LocationSuggestionDto toSuggestion(Map<String, Object> location) {
    String placeId = String.valueOf(location.getOrDefault("place_id", ""));
    Object addressObj = location.get("address");
    String display = null;

    if (addressObj instanceof Map<?, ?> address) {
      String city = readFirstNonBlank(
              asString(address.get("city")),
              asString(address.get("town")),
              asString(address.get("village")),
              asString(address.get("municipality")),
              asString(address.get("state")));
      String country = asString(address.get("country"));
      if (city != null && country != null) {
        display = city + ", " + country;
      } else if (country != null) {
        display = country;
      }
    }

    if (display == null || display.isBlank()) {
      String displayName = asString(location.get("display_name"));
      if (displayName != null && !displayName.isBlank()) {
        String[] parts = displayName.split(",");
        if (parts.length >= 2) {
          display = parts[0].trim() + ", " + parts[parts.length - 1].trim();
        } else {
          display = displayName.trim();
        }
      }
    }

    String keySource = placeId.isBlank() ? display : placeId;
    String key = normalizeLocationKey(keySource);
    return LocationSuggestionDto.builder().locationDisplay(display).locationKey(key).build();
  }

  private List<LocationSuggestionDto> fallbackSuggestions(String query, int limit) {
    String normalizedQuery = normalizeForSearch(query);
    return FALLBACK_LOCATIONS.stream()
            .filter(location -> normalizeForSearch(location).contains(normalizedQuery))
            .limit(limit)
            .map(location -> LocationSuggestionDto.builder()
                    .locationDisplay(location)
                    .locationKey(normalizeLocationKey(location))
                    .build())
            .collect(Collectors.toList());
  }

  private int normalizeLimit(Integer limit) {
    if (limit == null) {
      return DEFAULT_LIMIT;
    }
    return Math.max(1, Math.min(limit, MAX_LIMIT));
  }

  private String normalizeLocationKey(String raw) {
    if (raw == null) {
      return "";
    }
    return raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
  }

  private String asString(Object value) {
    if (value == null) {
      return null;
    }
    String stringValue = String.valueOf(value).trim();
    return stringValue.isEmpty() ? null : stringValue;
  }

  private String readFirstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }
    return null;
  }

  private boolean isCountryLevel(Map<String, Object> location) {
    String addresstype = asString(location.get("addresstype"));
    String type = asString(location.get("type"));
    return "country".equalsIgnoreCase(addresstype) || "country".equalsIgnoreCase(type);
  }

  private String normalizeForSearch(String raw) {
    if (raw == null) {
      return "";
    }
    String noAccent = Normalizer.normalize(raw, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    return noAccent.toLowerCase(Locale.ROOT).trim();
  }
}
