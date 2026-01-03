package com.hustlink.backend.features.messaging.repository;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.messaging.model.Conversation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
  Optional<Conversation> findByAuthorAndRecipient(User author, User recipient);

  List<Conversation> findByAuthorOrRecipient(User user1, User user2);
}
