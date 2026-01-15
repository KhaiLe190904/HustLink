package com.hustlink.backend.features.authentication.repository;

import com.hustlink.backend.features.authentication.model.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmail(String email);

  List<User> findAllByIdNot(Long id);

  @Query(value = "SELECT TOP (:limit) * FROM users " + "WHERE id NOT IN (:excludeIds) " + "AND profile_complete = 1 " + "ORDER BY NEWID()", nativeQuery = true)
  List<User> findRandomCompleteProfiles(@Param("excludeIds") List<Long> excludeIds, @Param("limit") int limit);
}
