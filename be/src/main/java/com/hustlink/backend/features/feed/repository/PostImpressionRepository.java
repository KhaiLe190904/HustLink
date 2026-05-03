package com.hustlink.backend.features.feed.repository;

import com.hustlink.backend.features.feed.model.PostImpression;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PostImpressionRepository extends JpaRepository<PostImpression, Long> {
  List<PostImpression> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);

  Optional<PostImpression> findByUserIdAndPostId(Long userId, Long postId);

  List<PostImpression> findByUserIdAndPostAuthorIdIn(Long userId, java.util.Set<Long> authorIds);

  @Modifying
  @Query(value = "delete from post_impressions where post_id = :postId", nativeQuery = true)
  void deleteByPostId(@Param("postId") Long postId);
}
