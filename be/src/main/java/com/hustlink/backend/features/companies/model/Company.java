package com.hustlink.backend.features.companies.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hustlink.backend.features.storage.model.StoredObject;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "companies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Company {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 200, columnDefinition = "nvarchar(200)")
  private String name;

  @Column(nullable = false, unique = true, length = 100)
  private String slug;

  @Lob
  @Column(columnDefinition = "nvarchar(max)")
  private String description;

  @Column(length = 200)
  private String website;

  @Column(columnDefinition = "nvarchar(100)")
  private String industry;

  @Column(length = 50)
  private String size;

  @Column(columnDefinition = "nvarchar(100)")
  private String headquarters;

  private String logoUrl;
  private String coverUrl;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "logo_stored_object_id")
  private StoredObject logoObject;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  @Builder.Default
  private CompanyStatus status = CompanyStatus.PENDING;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PrePersist
  void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    createdAt = now;
    updatedAt = now;
    if (status == null) {
      status = CompanyStatus.PENDING;
    }
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
