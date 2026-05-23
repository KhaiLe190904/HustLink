package com.hustlink.backend.features.ai.repository;

import com.hustlink.backend.features.ai.model.InterviewQuestionBank;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewQuestionBankRepository extends JpaRepository<InterviewQuestionBank, Long> {
}
