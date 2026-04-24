package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.InterviewQuestion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, Long> {
  Optional<InterviewQuestion> findByIdAndSessionId(Long id, Long sessionId);

  List<InterviewQuestion> findBySessionIdOrderByQuestionOrderAsc(Long sessionId);

  Optional<InterviewQuestion> findBySessionIdAndQuestionOrder(Long sessionId, Integer questionOrder);
}
