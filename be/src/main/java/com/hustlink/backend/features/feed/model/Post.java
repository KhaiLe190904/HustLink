package com.hustlink.backend.features.feed.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotEmpty;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity(name = "posts")
@Table(indexes = {@Index(name = "idx_posts_author_id", columnList = "author_id"), @Index(name = "idx_posts_creation_date", columnList = "creationDate DESC"), @Index(name = "idx_posts_author_creation", columnList = "author_id, creationDate DESC")
})
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Post {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @NotEmpty
  private String content;
  private String picture;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "post_media_urls", joinColumns = @JoinColumn(name = "post_id"))
  @Column(name = "media_url", nullable = false, length = 1000)
  private List<String> mediaUrls = new ArrayList<>();

  @ManyToOne
  @JoinColumn(name = "author_id", nullable = false)
  private User author;

  @CreationTimestamp
  private LocalDateTime creationDate;

  private LocalDateTime updateDate;

  @JsonIgnore
  @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<Comment> comments;

  @JsonIgnore
  @ManyToMany
  @JoinTable(name = "post_like", joinColumns = @JoinColumn(name = "post_id"), inverseJoinColumns = @JoinColumn(name = "user_id"))
  private Set<User> likes;

  @PreUpdate
  public void preUpdate() {
    updateDate = LocalDateTime.now();
  }

  public Post(String content, User author) {
    this.content = content;
    this.author = author;
  }
}
