package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "interview_answers")
@Getter
@Setter
public class InterviewAnswer {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id", nullable = false)
  @JsonIgnore
  private InterviewSession session;

  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "question_id", nullable = false, unique = true)
  @JsonIgnore
  private InterviewQuestion question;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String answerText;

  private Integer durationSeconds;

  private Integer score;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String feedback;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String strengths;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String improvements;

  @Column(nullable = false)
  private LocalDateTime answeredAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    answeredAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
