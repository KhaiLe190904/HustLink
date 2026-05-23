package com.hustlink.backend.features.ai.rag;

import com.hustlink.backend.features.ai.rag.dto.InterviewQuestionBankImportRequest;
import com.hustlink.backend.features.ai.rag.dto.RagImportResponse;
import com.hustlink.backend.features.ai.rag.dto.RagStatsResponse;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/rag")
@RequireRole(UserRole.ADMIN)
@RequiredArgsConstructor
public class RagAdminController {
  private final RagInterviewServiceImpl ragInterviewService;

  @PostMapping("/import")
  public RagImportResponse importQuestions(
                                           @RequestAttribute("authenticationUser") User user, @RequestBody List<InterviewQuestionBankImportRequest> requests) {
    return ragInterviewService.importQuestions(user, requests);
  }

  @PostMapping("/reindex")
  public RagStatsResponse reindex(@RequestAttribute("authenticationUser") User user) {
    return ragInterviewService.reindexAllAndStats(user);
  }

  @GetMapping("/stats")
  public RagStatsResponse stats() {
    return ragInterviewService.getStats();
  }
}
