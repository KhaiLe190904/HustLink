package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.InterviewAnswer;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewAnswerRepository extends JpaRepository<InterviewAnswer, Long> {
  Optional<InterviewAnswer> findByQuestionId(Long questionId);

  List<InterviewAnswer> findBySessionIdOrderByQuestionQuestionOrderAsc(Long sessionId);
}
