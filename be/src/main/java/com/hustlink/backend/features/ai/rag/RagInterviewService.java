package com.hustlink.backend.features.ai.rag;

import com.hustlink.backend.features.ai.model.InterviewQuestionBank;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import com.hustlink.backend.features.ai.rag.dto.RagQuestionContext;
import java.util.List;

public interface RagInterviewService {
  List<String> retrieveRelevantQuestions(
                                         String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK);

  List<RagQuestionContext> retrieveRelevantQuestionContexts(
                                                            String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK);

  void indexQuestion(InterviewQuestionBank question);

  void reindexAll();
}
