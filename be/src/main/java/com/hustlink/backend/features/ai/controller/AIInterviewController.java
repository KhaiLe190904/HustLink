package com.hustlink.backend.features.ai.controller;

import com.hustlink.backend.features.ai.dto.*;
import com.hustlink.backend.features.ai.service.AIInterviewService;
import com.hustlink.backend.features.authentication.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai/interviews")
@RequiredArgsConstructor
public class AIInterviewController {
  private final AIInterviewService aiInterviewService;

  @PostMapping("/start")
  public InterviewStartResponse startInterview(
                                               @RequestAttribute("authenticationUser") User user, @RequestBody InterviewStartRequest request) {
    return aiInterviewService.startInterview(user, request);
  }

  @GetMapping("/active")
  public InterviewStartResponse getActiveSession(@RequestAttribute("authenticationUser") User user) {
    return aiInterviewService.getActiveSession(user);
  }

  @PostMapping("/{sessionId}/answers")
  public InterviewSubmitAnswerResponse submitAnswer(
                                                    @RequestAttribute("authenticationUser") User user, @PathVariable Long sessionId, @RequestBody InterviewAnswerRequest request) {
    return aiInterviewService.submitAnswer(user, sessionId, request);
  }

  @GetMapping("/{sessionId}/results")
  public InterviewResultResponse getResults(
                                            @RequestAttribute("authenticationUser") User user, @PathVariable Long sessionId) {
    return aiInterviewService.getResults(user, sessionId);
  }

  @GetMapping("/history")
  public Page<InterviewSessionSummaryResponse> getHistory(
                                                          @RequestAttribute("authenticationUser") User user, @PageableDefault(size = 10) Pageable pageable) {
    return aiInterviewService.getHistory(user, pageable);
  }
}
