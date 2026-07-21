package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.jobs.model.Job;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "cv_job_analyses", uniqueConstraints = {@UniqueConstraint(columnNames = {"cv_id", "job_id"})})
@Getter
@Setter
public class CVJobAnalysis {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "cv_id", nullable = false)
  @JsonIgnore
  private CV cv;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "job_id", nullable = false)
  private Job job;

  @Column
  private Integer score;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CVJobAnalysisStatus status;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String summary;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String strengths;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String improvements;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String extractedSkills;

  @Column
  private Integer matchScore;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String matchBreakdown;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String matchReasoning;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String jobSnapshot;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
