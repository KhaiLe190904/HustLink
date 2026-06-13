package com.hustlink.backend.features.events.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "event_rsvps", uniqueConstraints = {@UniqueConstraint(columnNames = {"event_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventRsvp {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "event_id", nullable = false)
  private Event event;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private RsvpStatus status;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  @PrePersist
  void onCreate() {
    createdAt = LocalDateTime.now();
  }
}
