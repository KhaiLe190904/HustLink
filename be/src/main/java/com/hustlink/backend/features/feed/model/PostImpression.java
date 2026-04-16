package com.hustlink.backend.features.feed.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity(name = "post_impressions")
@Table(
        uniqueConstraints = {@UniqueConstraint(name = "uk_post_impressions_user_post", columnNames = {"user_id", "post_id"})
        }, indexes = {@Index(name = "idx_post_impressions_user", columnList = "user_id"), @Index(name = "idx_post_impressions_post", columnList = "post_id"), @Index(name = "idx_post_impressions_viewed_at", columnList = "viewedAt")
        })
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PostImpression {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "post_id", nullable = false)
  private Post post;

  @Column(nullable = false)
  private LocalDateTime servedAt;

  private LocalDateTime viewedAt;
}
