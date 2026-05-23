package com.hustlink.backend.features.ai.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "interview_question_bank")
@Getter
@Setter
public class InterviewQuestionBank {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String questionText;

  @Column(nullable = false, length = 100)
  private String targetPosition;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private InterviewLevel level;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private InterviewQuestionCategory category;

  @Column(length = 20)
  private String difficulty;

  @Column(length = 50)
  private String source;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String expectedPoints;

  @Column(nullable = false, length = 10)
  private String languageCode;

  @Column(nullable = false, unique = true, length = 100)
  private String vectorId;

  @Column(nullable = false)
  private LocalDateTime indexedAt;

  @PrePersist
  void onCreate() {
    if (vectorId == null || vectorId.isBlank()) {
      vectorId = UUID.randomUUID().toString();
    }
    if (indexedAt == null) {
      indexedAt = LocalDateTime.now();
    }
  }
}
