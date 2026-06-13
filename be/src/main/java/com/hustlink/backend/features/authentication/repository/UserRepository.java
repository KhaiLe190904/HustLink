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

  @Query("SELECT u FROM users u WHERE u.role <> com.hustlink.backend.features.authentication.model.UserRole.ADMIN AND " + "(:role IS NULL OR u.role = :role) AND " + "(:q IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :q, '%'))) AND " + "(:status IS NULL OR " + "(:status = 'BANNED' AND u.banned = true) OR " + "(:status = 'SUSPENDED' AND u.banned = false AND u.suspensionExpiresAt IS NOT NULL AND u.suspensionExpiresAt > :now) OR " + "(:status = 'ACTIVE' AND u.banned = false AND (u.suspensionExpiresAt IS NULL OR u.suspensionExpiresAt <= :now)))")
  org.springframework.data.domain.Page<User> searchUsers(
                                                         @Param("role") com.hustlink.backend.features.authentication.model.UserRole role, @Param("status") String status, @Param("q") String q, @Param("now") java.time.LocalDateTime now, org.springframework.data.domain.Pageable pageable);
}
