package com.hustlink.backend.features.events.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.companies.model.Company;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import lombok.*;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Event {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organizer_id", nullable = false)
  private User organizer;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "host_company_id")
  private Company hostCompany;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 50)
  private EventType type;

  @Column(nullable = false, length = 200, columnDefinition = "nvarchar(200)")
  private String title;

  @Lob
  @Column(nullable = false, columnDefinition = "nvarchar(max)")
  private String description;

  @Column(nullable = false)
  private LocalDateTime startAt;

  @Column(nullable = false)
  private LocalDateTime endAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 50)
  private EventMode mode;

  private String onlineLink;
  @Column(columnDefinition = "nvarchar(255)")
  private String venue;
  private String cityCode;

  private Integer capacity;
  private String coverImageUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  @Builder.Default
  private EventStatus status = EventStatus.DRAFT;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "event_tags", joinColumns = @JoinColumn(name = "event_id"))
  @Column(name = "tag", length = 60, columnDefinition = "nvarchar(60)")
  @Builder.Default
  private Set<String> tags = new HashSet<>();

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
      status = EventStatus.DRAFT;
    }
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
