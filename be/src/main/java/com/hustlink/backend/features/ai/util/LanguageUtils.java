package com.hustlink.backend.features.ai.util;

import java.util.Locale;

public final class LanguageUtils {

  private LanguageUtils() {
  }

  public static String normalize(String languageCode) {
    if (languageCode == null || languageCode.isBlank()) {
      return "en";
    }
    String normalized = languageCode.trim().toLowerCase(Locale.ROOT);
    if (normalized.startsWith("vi")) {
      return "vi";
    }
    if (normalized.startsWith("en")) {
      return "en";
    }
    return normalized;
  }
}
