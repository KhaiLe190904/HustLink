package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.InterviewSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewSessionRepository extends JpaRepository<InterviewSession, Long> {
  Optional<InterviewSession> findByIdAndUserId(Long id, Long userId);

  Page<InterviewSession> findByUserIdOrderByStartedAtDesc(Long userId, Pageable pageable);
}
