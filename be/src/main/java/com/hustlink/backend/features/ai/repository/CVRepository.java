package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.CV;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CVRepository extends JpaRepository<CV, Long> {
  List<CV> findByUserIdOrderByUploadedAtDesc(Long userId);

  Optional<CV> findByIdAndUserId(Long id, Long userId);
}
