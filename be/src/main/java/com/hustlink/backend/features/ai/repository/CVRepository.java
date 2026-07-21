package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.CV;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CVRepository extends JpaRepository<CV, Long> {
  List<CV> findByUserIdOrderByUploadedAtDesc(Long userId);

  Optional<CV> findByIdAndUserId(Long id, Long userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT cv FROM CV cv WHERE cv.id = :id AND cv.user.id = :userId")
  Optional<CV> findByIdAndUserIdForUpdate(@Param("id") Long id, @Param("userId") Long userId);
}
