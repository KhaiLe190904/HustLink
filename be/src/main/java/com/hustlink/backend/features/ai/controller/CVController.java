package com.hustlink.backend.features.ai.controller;

import com.hustlink.backend.features.ai.dto.AIConfigResponse;
import com.hustlink.backend.features.ai.dto.CVAnalysisResponse;
import com.hustlink.backend.features.ai.dto.CVSummaryResponse;
import com.hustlink.backend.features.ai.dto.CVUploadResponse;
import com.hustlink.backend.features.ai.service.CVService;
import com.hustlink.backend.features.authentication.model.User;
import java.io.IOException;
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
                                                   @RequestAttribute("authenticationUser") User user, @RequestParam("file") MultipartFile file) throws IOException {
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

  @GetMapping("/{id}/analysis")
  public ResponseEntity<CVAnalysisResponse> getAnalysis(
                                                        @RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    return ResponseEntity.ok(cvService.getAnalysis(user, id));
  }

  @PostMapping("/{id}/analysis")
  public ResponseEntity<CVAnalysisResponse> analyzeCv(
                                                      @RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    return ResponseEntity.ok(cvService.analyzeCv(user, id));
  }

  @GetMapping("/config")
  public ResponseEntity<AIConfigResponse> getConfig(
                                                    @RequestAttribute("authenticationUser") User user) {
    return ResponseEntity.ok(cvService.getConfig(user));
  }
}
