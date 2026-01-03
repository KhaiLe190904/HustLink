package com.hustlink.backend.features.feed.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity(name = "comments")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Comment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "post_id", nullable = false)
  @JsonIgnore
  private Post post;

  @ManyToOne
  @JoinColumn(name = "author_id", nullable = false)
  private User author;

  @Column(nullable = false)
  private String content;

  @CreationTimestamp
  private LocalDateTime creationDate;

  private LocalDateTime updateDate;

  public Comment(Post post, User user, String content) {
    this.post = post;
    this.author = user;
    this.content = content;
  }

  @PreUpdate
  public void preUpdate() {
    updateDate = LocalDateTime.now();
  }
}
