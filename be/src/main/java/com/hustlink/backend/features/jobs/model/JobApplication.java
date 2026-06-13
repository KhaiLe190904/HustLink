package com.hustlink.backend.features.jobs.model;

import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "job_applications", uniqueConstraints = {@UniqueConstraint(columnNames = {"job_id", "applicant_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplication {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "job_id", nullable = false)
  private Job job;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "applicant_id", nullable = false)
  private User applicant;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "cv_id", nullable = false)
  private CV cv;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String coverLetter;

  @Column(nullable = false)
  private Integer matchScore;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String matchBreakdown;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String matchReasoning;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  @Builder.Default
  private ApplicationStatus status = ApplicationStatus.APPLIED;

  @Column(nullable = false)
  private LocalDateTime appliedAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    appliedAt = now;
    updatedAt = now;
    if (status == null) {
      status = ApplicationStatus.APPLIED;
    }
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
