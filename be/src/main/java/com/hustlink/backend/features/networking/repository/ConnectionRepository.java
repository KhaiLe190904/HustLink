package com.hustlink.backend.features.networking.repository;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConnectionRepository extends JpaRepository<Connection, Long> {
  boolean existsByAuthorAndRecipient(User sender, User recipient);

  List<Connection> findAllByAuthorOrRecipient(User userOne, User userTwo);

  @Query("SELECT c FROM connections c WHERE (c.author = :user OR c.recipient = :user) AND c.status = :status")
  List<Connection> findConnectionsByUserAndStatus(@Param("user") User user, @Param("status") Status status);

  List<Connection> findByAuthorIdAndStatusOrRecipientIdAndStatus(Long authenticatedUserId, Status status, Long authenticatedUserId1, Status status1);
}
