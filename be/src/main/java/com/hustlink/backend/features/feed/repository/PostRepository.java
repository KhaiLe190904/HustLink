package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.Post;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
  List<Post> findByAuthorIdInOrderByCreationDateDesc(Set<Long> connectedUserIds);

  List<Post> findAllByOrderByCreationDateDesc();

  List<Post> findByAuthorId(Long userId);
}
