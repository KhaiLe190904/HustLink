package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
  Page<Comment> findByPostOrderByCreationDateAsc(Post post, Pageable pageable);

  Page<Comment> findByPostOrderByCreationDateDesc(Post post, Pageable pageable);

  long countByPost(Post post);
}
