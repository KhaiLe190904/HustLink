package com.hustlink.backend.features.ai.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.storage.model.StoredObject;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "cvs")
@Getter
@Setter
public class CV {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  @JsonIgnore
  private User user;

  @Column(nullable = false)
  private String fileName;

  @Column(nullable = false)
  private String originalFileName;

  @Column(nullable = false)
  private String bucketName;

  @Column(nullable = false)
  private String objectKey;

  @Column(nullable = false)
  private String mimeType;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "stored_object_id", nullable = false)
  @JsonIgnore
  private StoredObject storedObject;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String extractedText;

  private Integer analysisScore;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String analysisSummary;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String analysisStrengths;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String analysisImprovements;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String recommendedQuestions;

  @Column(nullable = false)
  private LocalDateTime uploadedAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    uploadedAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
