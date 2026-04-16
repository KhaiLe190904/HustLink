package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
  Page<Comment> findByPostOrderByCreationDateAsc(Post post, Pageable pageable);

  Page<Comment> findByPostOrderByCreationDateDesc(Post post, Pageable pageable);

  long countByPost(Post post);

  @Query(
    "SELECT c.post.author.id, COUNT(c) " + "FROM comments c " + "WHERE c.author.id = :userId AND c.post.author.id IN :authorIds " + "GROUP BY c.post.author.id")
  List<Object[]> countCommentsByUserForAuthors(@Param("userId") Long userId, @Param("authorIds") Set<Long> authorIds);

  @Query("SELECT c.post.id, COUNT(c) FROM comments c WHERE c.post.id IN :postIds GROUP BY c.post.id")
  List<Object[]> countCommentsForPostIds(@Param("postIds") List<Long> postIds);
}
