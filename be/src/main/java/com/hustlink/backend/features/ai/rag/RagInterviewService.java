package com.hustlink.backend.features.ai.rag;

import com.hustlink.backend.features.ai.model.InterviewQuestionBank;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import com.hustlink.backend.features.ai.rag.dto.RagQuestionContext;
import com.hustlink.backend.features.ai.rag.dto.InterviewQuestionBankImportRequest;
import com.hustlink.backend.features.ai.rag.dto.RagImportResponse;
import com.hustlink.backend.features.ai.rag.dto.RagStatsResponse;
import com.hustlink.backend.features.authentication.model.User;
import java.util.List;

public interface RagInterviewService {
  List<String> retrieveRelevantQuestions(
                                         String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK);

  List<RagQuestionContext> retrieveRelevantQuestionContexts(
                                                            String cvSummary, String jobPosition, List<String> requestedStacks, InterviewLevel level, String languageCode, int topK);

  void indexQuestion(InterviewQuestionBank question);

  void reindexAll();

  RagImportResponse importQuestions(User admin, List<InterviewQuestionBankImportRequest> requests);

  RagStatsResponse reindexAllAndStats(User admin);

  RagStatsResponse getStats();
}
