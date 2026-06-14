package com.hustlink.backend.features.messaging.repository;

import com.hustlink.backend.features.messaging.model.Conversation;
import com.hustlink.backend.features.messaging.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
  Page<Message> findByConversationOrderByCreationAtDesc(Conversation conversation, Pageable pageable);

  @org.springframework.data.jpa.repository.Modifying
  @org.springframework.transaction.annotation.Transactional
  @org.springframework.data.jpa.repository.Query("UPDATE messages m SET m.sharedPost = null WHERE m.sharedPost.id = :postId")
  void nullifySharedPostId(@org.springframework.data.repository.query.Param("postId") Long postId);
}
