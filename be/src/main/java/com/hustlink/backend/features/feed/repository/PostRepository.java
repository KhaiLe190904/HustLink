package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.Post;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
  List<Post> findByAuthorIdInOrderByCreationDateDesc(Set<Long> connectedUserIds);

  Page<Post> findByAuthorIdInOrderByCreationDateDesc(Set<Long> connectedUserIds, Pageable pageable);

  List<Post> findAllByOrderByCreationDateDesc();

  Page<Post> findAllByOrderByCreationDateDesc(Pageable pageable);

  List<Post> findByAuthorId(Long userId);

  Page<Post> findByAuthorIdOrderByCreationDateDesc(Long userId, Pageable pageable);

  @Query("SELECT p.author.id, COUNT(p) FROM posts p " + "WHERE p.creationDate >= :since " + "GROUP BY p.author.id")
  List<Object[]> countPostsByAuthorSince(@Param("since") LocalDateTime since);

  @Query("SELECT COUNT(p) > 0 FROM posts p " + "WHERE p.author.id = :userId " + "AND p.creationDate >= :since")
  boolean hasRecentPosts(@Param("userId") Long userId, @Param("since") LocalDateTime since);

  @Query("SELECT COUNT(p) FROM posts p WHERE p.author.id = :userId")
  long countByAuthorId(@Param("userId") Long userId);
}
