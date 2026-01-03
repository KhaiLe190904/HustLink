package com.hustlink.backend.features.feed.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotEmpty;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity(name = "posts")
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
