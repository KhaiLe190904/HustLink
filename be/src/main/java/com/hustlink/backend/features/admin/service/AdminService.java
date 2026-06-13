package com.hustlink.backend.features.admin.service;

import com.hustlink.backend.features.admin.dto.*;
import com.hustlink.backend.features.admin.model.ContentReport;
import com.hustlink.backend.features.authentication.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AdminService {
  ContentReport createReport(User reporter, ReportRequest request);

  Page<User> getUsers(String role, String status, String q, Pageable pageable);

  LastRecruiterCheckResponse checkLastRecruiter(Long id);

  User changeUserRole(Long id, UserRoleChangeRequest request);

  void suspendUser(User admin, Long id, UserSuspendRequest request);

  void banUser(User admin, Long id, UserBanRequest request);

  void unbanUser(User admin, Long id);

  Page<ContentReport> getReports(String status, String targetType, Pageable pageable);

  ContentReport reviewReport(User admin, Long id, ReportReviewRequest request);

  AiUsageSummaryResponse getAiUsageSummary();

  List<AiUsageTimeseriesPoint> getAiUsageTimeseries();

  OverviewStatsResponse getOverviewStats();
}
