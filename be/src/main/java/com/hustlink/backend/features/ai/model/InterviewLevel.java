package com.hustlink.backend.features.ai.model;

import java.util.Locale;

public enum InterviewLevel {
  INTERN, FRESHER, JUNIOR, SENIOR;

  public static InterviewLevel fromValue(String value) {
    if (value == null || value.isBlank()) {
      return JUNIOR;
    }

    String normalized = value.trim().toUpperCase(Locale.ROOT);
    for (InterviewLevel level : values()) {
      if (level.name().equals(normalized)) {
        return level;
      }
    }
    return inferFromText(value);
  }

  public static InterviewLevel inferFromText(String text) {
    if (text == null || text.isBlank()) {
      return JUNIOR;
    }

    String normalized = text.toLowerCase(Locale.ROOT);
    if (normalized.contains("intern")) {
      return INTERN;
    }
    if (normalized.contains("fresher") || normalized.contains("new grad") || normalized.contains("entry")) {
      return FRESHER;
    }
    if (normalized.contains("senior") || normalized.contains("lead") || normalized.contains("principal")) {
      return SENIOR;
    }
    return JUNIOR;
  }
}
