package com.hustlink.backend.features.ai.model;

public enum InterviewQuestionCategory {
  TECHNICAL, BEHAVIORAL, PROJECT, COMMUNICATION, PROBLEM_SOLVING, GENERAL;

  public static InterviewQuestionCategory fromValue(String value) {
    if (value == null || value.isBlank()) {
      return GENERAL;
    }

    try {
      return InterviewQuestionCategory.valueOf(value.trim().toUpperCase());
    } catch (IllegalArgumentException exception) {
      return GENERAL;
    }
  }
}
