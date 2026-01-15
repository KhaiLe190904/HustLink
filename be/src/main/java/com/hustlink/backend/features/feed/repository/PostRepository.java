package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.Post;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
  List<Post> findByAuthorIdInOrderByCreationDateDesc(Set<Long> connectedUserIds);

  Page<Post> findByAuthorIdInOrderByCreationDateDesc(Set<Long> connectedUserIds, Pageable pageable);

  List<Post> findAllByOrderByCreationDateDesc();

  Page<Post> findAllByOrderByCreationDateDesc(Pageable pageable);

  List<Post> findByAuthorId(Long userId);

  Page<Post> findByAuthorIdOrderByCreationDateDesc(Long userId, Pageable pageable);
}
