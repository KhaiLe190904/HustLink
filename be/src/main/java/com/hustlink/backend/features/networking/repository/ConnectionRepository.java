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

  @Query("SELECT c FROM connections c " + "LEFT JOIN FETCH c.author " + "LEFT JOIN FETCH c.recipient " + "WHERE (c.author.id = :userId OR c.recipient.id = :userId) " + "AND c.status = com.hustlink.backend.features.networking.model.Status.ACCEPTED")
  List<Connection> findAllConnectionsByUser(@Param("userId") Long userId);

  @Query("SELECT c FROM connections c " + "LEFT JOIN FETCH c.author " + "LEFT JOIN FETCH c.recipient " + "WHERE (c.author.id = :userId OR c.recipient.id = :userId) " + "AND (c.status = com.hustlink.backend.features.networking.model.Status.ACCEPTED OR c.status = com.hustlink.backend.features.networking.model.Status.PENDING)")
  List<Connection> findAllConnectionsAndPendingByUser(@Param("userId") Long userId);

  @Query("SELECT c FROM connections c " + "LEFT JOIN FETCH c.author " + "LEFT JOIN FETCH c.recipient " + "WHERE (c.author.id IN :connectionIds OR c.recipient.id IN :connectionIds) " + "AND c.status = :status")
  List<Connection> findSecondDegreeConnections(@Param("connectionIds") List<Long> connectionIds, @Param("status") Status status);

  @Query("SELECT COUNT(DISTINCT c1.id) FROM connections c1 " + "WHERE c1.status = com.hustlink.backend.features.networking.model.Status.ACCEPTED " + "AND ((c1.author.id = :userId1 AND c1.recipient.id IN " + "(SELECT CASE WHEN c2.author.id = :userId2 THEN c2.recipient.id ELSE c2.author.id END FROM connections c2 " + "WHERE (c2.author.id = :userId2 OR c2.recipient.id = :userId2) AND c2.status = com.hustlink.backend.features.networking.model.Status.ACCEPTED))" + "OR (c1.recipient.id = :userId1 AND c1.author.id IN " + "(SELECT CASE WHEN c2.author.id = :userId2 THEN c2.recipient.id ELSE c2.author.id END FROM connections c2 " + "WHERE (c2.author.id = :userId2 OR c2.recipient.id = :userId2) AND c2.status = com.hustlink.backend.features.networking.model.Status.ACCEPTED)))")
  int countMutualConnections(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
}
