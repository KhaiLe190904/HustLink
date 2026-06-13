package com.hustlink.backend.features.jobs.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.companies.model.Company;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import lombok.*;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Job {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "company_id", nullable = false)
  private Company company;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "posted_by_user_id", nullable = false)
  private User postedBy;

  @Column(nullable = false, length = 200, columnDefinition = "nvarchar(200)")
  private String title;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String description;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String requirements;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String responsibilities;

  @Column(length = 100, columnDefinition = "nvarchar(max)")
  private String location;

  @Enumerated(EnumType.STRING)
  @Column(length = 50)
  private JobType jobType;

  @Enumerated(EnumType.STRING)
  @Column(length = 50)
  private WorkMode workMode;

  private Integer salaryMin;
  private Integer salaryMax;

  @Column(length = 3)
  private String salaryCurrency;

  @Column(length = 50, columnDefinition = "nvarchar(50)")
  private String experienceLevel;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "job_skills", joinColumns = @JoinColumn(name = "job_id"))
  @Column(name = "skill", length = 80, columnDefinition = "nvarchar(80)")
  @Builder.Default
  private Set<String> skills = new HashSet<>();

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  @Builder.Default
  private JobStatus status = JobStatus.DRAFT;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  private LocalDateTime publishedAt;
  private LocalDateTime closedAt;
  private LocalDateTime applicationDeadline;

  private String vectorId;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    createdAt = now;
    if (status == null) {
      status = JobStatus.DRAFT;
    }
  }
}
