package com.hustlink.backend.features.admin.controller;

import com.hustlink.backend.features.admin.dto.*;
import com.hustlink.backend.features.admin.model.ContentReport;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import com.hustlink.backend.features.admin.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AdminController {

  private final AdminService adminService;

  // Any authenticated user can report content
  @PostMapping("/reports")
  public ResponseEntity<ContentReport> createReport(
                                                    @RequestAttribute("authenticationUser") User reporter, @RequestBody ReportRequest dto
  ) {
    ContentReport saved = adminService.createReport(reporter, dto);
    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }

  // --- ADMIN ENDPOINTS ---

  @GetMapping("/admin/users")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Page<User>> getUsers(
                                             @RequestParam(required = false) String role, @RequestParam(required = false) String status, @RequestParam(required = false) String q, @PageableDefault(size = 10) Pageable pageable
  ) {
    Page<User> users = adminService.getUsers(role, status, q, pageable);
    return ResponseEntity.ok(users);
  }

  @GetMapping("/admin/users/{id}/check-last-recruiter")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<LastRecruiterCheckResponse> checkLastRecruiter(@PathVariable Long id) {
    LastRecruiterCheckResponse response = adminService.checkLastRecruiter(id);
    return ResponseEntity.ok(response);
  }

  @PatchMapping("/admin/users/{id}/role")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<User> changeUserRole(
                                             @PathVariable Long id, @RequestBody UserRoleChangeRequest request
  ) {
    User saved = adminService.changeUserRole(id, request);
    return ResponseEntity.ok(saved);
  }

  @PostMapping("/admin/users/{id}/suspend")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Void> suspendUser(
                                          @RequestAttribute("authenticationUser") User admin, @PathVariable Long id, @RequestBody UserSuspendRequest request
  ) {
    adminService.suspendUser(admin, id, request);
    return ResponseEntity.ok().build();
  }

  @PostMapping("/admin/users/{id}/ban")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Void> banUser(
                                      @RequestAttribute("authenticationUser") User admin, @PathVariable Long id, @RequestBody UserBanRequest request
  ) {
    adminService.banUser(admin, id, request);
    return ResponseEntity.ok().build();
  }

  @PostMapping("/admin/users/{id}/unban")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Void> unbanUser(
                                        @RequestAttribute("authenticationUser") User admin, @PathVariable Long id
  ) {
    adminService.unbanUser(admin, id);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/admin/reports")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Page<ContentReport>> getReports(
                                                        @RequestParam(required = false) String status, @RequestParam(required = false) String targetType, @PageableDefault(size = 10) Pageable pageable
  ) {
    Page<ContentReport> reports = adminService.getReports(status, targetType, pageable);
    return ResponseEntity.ok(reports);
  }

  @PatchMapping("/admin/reports/{id}/review")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<ContentReport> reviewReport(
                                                    @RequestAttribute("authenticationUser") User admin, @PathVariable Long id, @RequestBody ReportReviewRequest request
  ) {
    ContentReport saved = adminService.reviewReport(admin, id, request);
    return ResponseEntity.ok(saved);
  }

  // --- AI USAGE STATS ---

  @GetMapping("/admin/ai-usage/summary")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<AiUsageSummaryResponse> getAiUsageSummary() {
    AiUsageSummaryResponse summary = adminService.getAiUsageSummary();
    return ResponseEntity.ok(summary);
  }

  @GetMapping("/admin/ai-usage/timeseries")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<List<AiUsageTimeseriesPoint>> getAiUsageTimeseries() {
    List<AiUsageTimeseriesPoint> timeseries = adminService.getAiUsageTimeseries();
    return ResponseEntity.ok(timeseries);
  }

  // --- OVERVIEW STATS ---

  @GetMapping("/admin/stats/overview")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<OverviewStatsResponse> getOverviewStats() {
    OverviewStatsResponse stats = adminService.getOverviewStats();
    return ResponseEntity.ok(stats);
  }
}
