package com.hustlink.backend.features.ai.controller;

import com.hustlink.backend.features.ai.dto.AIConfigResponse;
import com.hustlink.backend.features.ai.dto.CVContextDebugResponse;
import com.hustlink.backend.features.ai.dto.CVJobAnalysisResponse;
import com.hustlink.backend.features.ai.dto.CVSummaryResponse;
import com.hustlink.backend.features.ai.dto.CVUploadResponse;
import com.hustlink.backend.features.ai.service.CVService;
import com.hustlink.backend.features.authentication.model.User;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/ai/cvs")
public class CVController {
  private final CVService cvService;

  @PostMapping("/upload")
  public ResponseEntity<CVUploadResponse> uploadCv(
                                                   @RequestAttribute("authenticationUser") User user, @RequestParam("file") MultipartFile file) {
    return ResponseEntity.ok(cvService.uploadCv(user, file));
  }

  @GetMapping("/mine")
  public ResponseEntity<List<CVSummaryResponse>> getMyCvs(
                                                          @RequestAttribute("authenticationUser") User user) {
    return ResponseEntity.ok(cvService.getMyCvs(user));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteCv(
                                       @RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    cvService.deleteCv(user, id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/jd-analysis")
  public ResponseEntity<CVJobAnalysisResponse> analyzeCvForJob(
                                                               @RequestAttribute("authenticationUser") User user, @PathVariable Long id, @RequestParam Long jobId) {
    return ResponseEntity.ok(cvService.analyzeCvForJob(user, id, jobId));
  }

  @GetMapping("/{id}/jd-analysis")
  public ResponseEntity<CVJobAnalysisResponse> getJobAnalysisByCvAndJob(
                                                                        @RequestAttribute("authenticationUser") User user, @PathVariable Long id, @RequestParam Long jobId) {
    CVJobAnalysisResponse response = cvService.getJobAnalysisByCvAndJob(user, id, jobId);
    if (response == null) {
      return ResponseEntity.noContent().build();
    }
    return ResponseEntity.ok(response);
  }

  @GetMapping("/jd-analyses/{analysisId}")
  public ResponseEntity<CVJobAnalysisResponse> getJobAnalysis(
                                                              @RequestAttribute("authenticationUser") User user, @PathVariable Long analysisId) {
    return ResponseEntity.ok(cvService.getJobAnalysis(user, analysisId));
  }

  @GetMapping("/jd-analyses")
  public ResponseEntity<List<CVJobAnalysisResponse>> getJobAnalyses(
                                                                    @RequestAttribute("authenticationUser") User user, @RequestParam(required = false) Long cvId) {
    return ResponseEntity.ok(cvService.getJobAnalyses(user, cvId));
  }

  @GetMapping("/{id}/context-debug")
  public ResponseEntity<CVContextDebugResponse> debugCvContext(
                                                               @RequestAttribute("authenticationUser") User user, @PathVariable Long id, @RequestParam(required = false) String jobPosition, @RequestParam(required = false, defaultValue = "JUNIOR") String level) {
    return ResponseEntity.ok(cvService.debugContext(user, id, jobPosition, level));
  }

  @PostMapping("/context-debug")
  public ResponseEntity<CVContextDebugResponse> debugUploadedCvContext(
                                                                       @RequestAttribute("authenticationUser") User user, @RequestParam("file") MultipartFile file, @RequestParam(required = false) String jobPosition, @RequestParam(required = false, defaultValue = "JUNIOR") String level) {
    return ResponseEntity.ok(cvService.debugUploadedContext(user, file, jobPosition, level));
  }

  @GetMapping("/config")
  public ResponseEntity<AIConfigResponse> getConfig(
                                                    @RequestAttribute("authenticationUser") User user) {
    return ResponseEntity.ok(cvService.getConfig(user));
  }
}
