package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "interview_sessions")
@Getter
@Setter
public class InterviewSession {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  @JsonIgnore
  private User user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "cv_id", nullable = false)
  @JsonIgnore
  private CV cv;

  @Column(nullable = false)
  private String jobPosition;

  @Column(nullable = false)
  private String languageCode;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private InterviewLevel interviewLevel;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private InterviewSessionStatus status;

  @Column(nullable = false)
  private Integer totalQuestions;

  @Column(nullable = false)
  private Integer currentQuestionIndex;

  @Column(nullable = false)
  private Integer answerTimeLimitSeconds;

  private Integer overallScore;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String overallSummary;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String overallStrengths;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String overallImprovements;

  @Column(nullable = false)
  private LocalDateTime startedAt;

  private LocalDateTime completedAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("questionOrder ASC")
  @JsonIgnore
  private List<InterviewQuestion> questions = new ArrayList<>();

  @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
  @JsonIgnore
  private List<InterviewAnswer> answers = new ArrayList<>();

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    startedAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
