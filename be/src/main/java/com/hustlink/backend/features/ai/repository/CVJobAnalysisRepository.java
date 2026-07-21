package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.CVJobAnalysis;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CVJobAnalysisRepository extends JpaRepository<CVJobAnalysis, Long> {
  Optional<CVJobAnalysis> findByCvIdAndJobId(Long cvId, Long jobId);

  Optional<CVJobAnalysis> findByIdAndCvUserId(Long id, Long userId);

  List<CVJobAnalysis> findByCvUserIdOrderByUpdatedAtDesc(Long userId);

  List<CVJobAnalysis> findByCvIdAndCvUserIdOrderByUpdatedAtDesc(Long cvId, Long userId);

  boolean existsByCvIdAndJobId(Long cvId, Long jobId);

  void deleteByJobId(Long jobId);
}
