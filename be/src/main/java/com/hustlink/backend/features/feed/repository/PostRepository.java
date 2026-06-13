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

  List<Post> findByAuthorIdInAndHiddenFalseOrderByCreationDateDesc(Set<Long> connectedUserIds);

  Page<Post> findByAuthorIdInAndHiddenFalseOrderByCreationDateDesc(Set<Long> connectedUserIds, Pageable pageable);

  List<Post> findAllByHiddenFalseOrderByCreationDateDesc();

  Page<Post> findAllByHiddenFalseOrderByCreationDateDesc(Pageable pageable);

  List<Post> findByAuthorIdAndHiddenFalse(Long userId);

  Page<Post> findByAuthorIdAndHiddenFalseOrderByCreationDateDesc(Long userId, Pageable pageable);

  @Query("SELECT p.author.id, COUNT(p) FROM posts p " + "WHERE p.creationDate >= :since " + "GROUP BY p.author.id")
  List<Object[]> countPostsByAuthorSince(@Param("since") LocalDateTime since);

  @Query("SELECT COUNT(p) > 0 FROM posts p " + "WHERE p.author.id = :userId " + "AND p.creationDate >= :since")
  boolean hasRecentPosts(@Param("userId") Long userId, @Param("since") LocalDateTime since);

  @Query("SELECT COUNT(p) FROM posts p WHERE p.author.id = :userId")
  long countByAuthorId(@Param("userId") Long userId);

  @Query(
    "SELECT p.author.id, COUNT(l) " + "FROM posts p JOIN p.likes l " + "WHERE l.id = :userId AND p.author.id IN :authorIds " + "GROUP BY p.author.id")
  List<Object[]> countLikedPostsByUserForAuthors(@Param("userId") Long userId, @Param("authorIds") Set<Long> authorIds);

  @Query(
    "SELECT p.id, COUNT(l) " + "FROM posts p LEFT JOIN p.likes l " + "WHERE p.id IN :postIds " + "GROUP BY p.id")
  List<Object[]> countLikesForPostIds(@Param("postIds") List<Long> postIds);

  @Query(
    "SELECT p.id " + "FROM posts p JOIN p.likes l " + "WHERE p.id IN :postIds AND l.id = :userId")
  List<Long> findLikedPostIdsByUser(@Param("postIds") List<Long> postIds, @Param("userId") Long userId);
}
