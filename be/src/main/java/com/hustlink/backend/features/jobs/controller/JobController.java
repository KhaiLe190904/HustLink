package com.hustlink.backend.features.jobs.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import com.hustlink.backend.features.jobs.dto.*;
import com.hustlink.backend.features.jobs.service.JobService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class JobController {
  private final JobService jobService;

  @PostMapping("/jobs")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<JobResponse> createJob(
                                               @Valid @RequestBody JobRequest request, @RequestAttribute("authenticationUser") User user) {
    JobResponse job = jobService.createJob(request, user);
    return ResponseEntity.ok(job);
  }

  @PatchMapping("/jobs/{id}")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<JobResponse> updateJob(
                                               @PathVariable Long id, @Valid @RequestBody JobRequest request, @RequestAttribute("authenticationUser") User user) {
    JobResponse job = jobService.updateJob(id, request, user);
    return ResponseEntity.ok(job);
  }

  @PatchMapping("/jobs/{id}/publish")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<JobResponse> publishJob(
                                                @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    JobResponse job = jobService.publishJob(id, user);
    return ResponseEntity.ok(job);
  }

  @PatchMapping("/jobs/{id}/close")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<JobResponse> closeJob(
                                              @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    JobResponse job = jobService.closeJob(id, user);
    return ResponseEntity.ok(job);
  }

  @DeleteMapping("/jobs/{id}")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<Void> deleteJob(
                                        @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    jobService.deleteJob(id, user);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/jobs")
  public ResponseEntity<Page<JobResponse>> searchJobs(
                                                      @RequestParam(required = false) String q, @RequestParam(required = false) String location, @RequestParam(required = false) String skill, @RequestParam(required = false) Integer minSalary, @PageableDefault(size = 6) Pageable pageable) {
    Page<JobResponse> jobs = jobService.searchJobs(q, location, skill, minSalary, pageable);
    return ResponseEntity.ok(jobs);
  }

  @GetMapping("/jobs/recommended")
  public ResponseEntity<List<JobResponse>> getRecommendedJobs(
                                                              @RequestAttribute("authenticationUser") User user) {
    List<JobResponse> jobs = jobService.getRecommendedJobs(user);
    return ResponseEntity.ok(jobs);
  }

  @GetMapping("/jobs/{id}")
  public ResponseEntity<JobResponse> getJobDetail(@PathVariable Long id) {
    JobResponse job = jobService.getJobDetail(id);
    return ResponseEntity.ok(job);
  }

  @PostMapping("/jobs/{id}/apply")
  public ResponseEntity<JobApplicationResponse> applyJob(
                                                         @PathVariable Long id, @Valid @RequestBody JobApplicationRequest request, @RequestAttribute("authenticationUser") User user) {
    JobApplicationResponse app = jobService.applyJob(id, request, user);
    return ResponseEntity.ok(app);
  }

  @GetMapping("/jobs/my-applications")
  public ResponseEntity<List<JobApplicationResponse>> getMyApplications(
                                                                        @RequestAttribute("authenticationUser") User user) {
    List<JobApplicationResponse> apps = jobService.getMyApplications(user);
    return ResponseEntity.ok(apps);
  }

  @GetMapping("/jobs/{id}/applications")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<List<JobApplicationResponse>> getJobApplications(
                                                                         @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    List<JobApplicationResponse> apps = jobService.getJobApplications(id, user);
    return ResponseEntity.ok(apps);
  }

  @PatchMapping("/jobs/applications/{appId}/status")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<JobApplicationResponse> updateApplicationStatus(
                                                                        @PathVariable Long appId, @RequestBody Map<String, String> body, @RequestAttribute("authenticationUser") User user) {
    String status = body.get("status");
    JobApplicationResponse app = jobService.updateApplicationStatus(appId, status, user);
    return ResponseEntity.ok(app);
  }

  @GetMapping("/jobs/applications/{appId}/cv-url")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<Map<String, String>> getCvDownloadUrl(
                                                              @PathVariable Long appId, @RequestAttribute("authenticationUser") User user) {
    String url = jobService.getCvDownloadUrl(appId, user);
    return ResponseEntity.ok(Map.of("url", url));
  }

  @PostMapping("/jobs/{id}/save")
  public ResponseEntity<Void> saveJob(
                                      @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    jobService.saveJob(id, user);
    return ResponseEntity.ok().build();
  }

  @DeleteMapping("/jobs/{id}/save")
  public ResponseEntity<Void> unsaveJob(
                                        @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    jobService.unsaveJob(id, user);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/jobs/saved")
  public ResponseEntity<List<JobResponse>> getSavedJobs(
                                                        @RequestAttribute("authenticationUser") User user) {
    List<JobResponse> jobs = jobService.getSavedJobs(user);
    return ResponseEntity.ok(jobs);
  }

  @GetMapping("/companies/{companyId}/jobs")
  public ResponseEntity<List<JobResponse>> getCompanyJobs(
                                                          @PathVariable Long companyId, @RequestParam(required = false, defaultValue = "false") boolean includeDrafts, @RequestAttribute(value = "authenticationUser", required = false) User user) {
    List<JobResponse> jobs = jobService.getCompanyJobs(companyId, includeDrafts, user);
    return ResponseEntity.ok(jobs);
  }

  @GetMapping("/jobs/my-jobs")
  @RequireRole(UserRole.RECRUITER)
  public ResponseEntity<List<JobResponse>> getMyJobs(
                                                     @RequestAttribute("authenticationUser") User user) {
    List<JobResponse> jobs = jobService.getRecruiterJobs(user);
    return ResponseEntity.ok(jobs);
  }

  @PostMapping("/admin/jobs/reindex")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Map<String, Integer>> reindexAllJobs() {
    int indexedCount = jobService.reindexAllJobsInVectorStore();
    return ResponseEntity.ok(Map.of("indexedCount", indexedCount));
  }
}
