package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.InterviewQuestionBank;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InterviewQuestionBankRepository extends JpaRepository<InterviewQuestionBank, Long> {

  @Query("SELECT CASE WHEN COUNT(q) > 0 THEN true ELSE false END FROM InterviewQuestionBank q " + "WHERE q.questionText = :questionText AND q.targetPosition = :targetPosition AND q.level = :level")
  boolean existsByQuestionTextAndTargetPositionAndLevel(
                                                        @Param("questionText") String questionText, @Param("targetPosition") String targetPosition, @Param("level") InterviewLevel level
  );
}
