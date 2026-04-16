package com.hustlink.backend.features.storage.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "stored_objects")
@Getter
@Setter
public class StoredObject {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private StorageScope scope;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "uploaded_by")
  @JsonIgnore
  private User uploadedBy;

  @Column(nullable = false)
  private String bucketName;

  @Column(nullable = false, unique = true, length = 512)
  private String objectKey;

  @Column(nullable = false)
  private String originalFileName;

  @Column(nullable = false)
  private String contentType;

  @Column(nullable = false)
  private Long sizeInBytes;

  @Column(nullable = false)
  private Long originalSizeInBytes;

  @Column(nullable = false)
  private Boolean optimized;

  @Column(nullable = false)
  private Boolean publicRead;

  private String ownerType;

  private Long ownerId;

  @Column(nullable = false)
  private LocalDateTime uploadedAt;

  @PrePersist
  void onCreate() {
    uploadedAt = LocalDateTime.now();
  }
}
