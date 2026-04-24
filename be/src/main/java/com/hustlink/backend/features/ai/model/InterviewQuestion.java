package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "interview_questions")
@Getter
@Setter
public class InterviewQuestion {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id", nullable = false)
  @JsonIgnore
  private InterviewSession session;

  @Column(nullable = false)
  private Integer questionOrder;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private InterviewQuestionCategory category;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String questionText;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String expectedPoints;
}
