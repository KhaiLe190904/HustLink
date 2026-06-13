package com.hustlink.backend.features.jobs.repository;

import com.hustlink.backend.features.jobs.model.SavedJob;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SavedJobRepository extends JpaRepository<SavedJob, Long> {
  List<SavedJob> findByUserId(Long userId);

  Optional<SavedJob> findByUserIdAndJobId(Long userId, Long jobId);

  boolean existsByUserIdAndJobId(Long userId, Long jobId);
}
