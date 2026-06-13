package com.hustlink.backend.features.admin.service;

import com.hustlink.backend.features.admin.dto.*;
import com.hustlink.backend.features.admin.model.*;
import com.hustlink.backend.features.admin.repository.ContentReportRepository;
import com.hustlink.backend.features.admin.repository.ModerationActionRepository;
import com.hustlink.backend.features.ai.model.AIUsageLog;
import com.hustlink.backend.features.ai.repository.AIUsageLogRepository;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyMember;
import com.hustlink.backend.features.companies.model.CompanyRole;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import com.hustlink.backend.features.companies.repository.CompanyRepository;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.events.repository.EventRepository;
import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.repository.CommentRepository;
import com.hustlink.backend.features.feed.repository.PostRepository;
import com.hustlink.backend.features.jobs.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

  private final UserRepository userRepository;
  private final PostRepository postRepository;
  private final CommentRepository commentRepository;
  private final JobRepository jobRepository;
  private final CompanyRepository companyRepository;
  private final EventRepository eventRepository;
  private final ContentReportRepository contentReportRepository;
  private final ModerationActionRepository moderationActionRepository;
  private final AIUsageLogRepository aiUsageLogRepository;
  private final CompanyMemberRepository companyMemberRepository;

  @Override
  @Transactional
  public ContentReport createReport(User reporter, ReportRequest request) {
    if (request.targetType() == null || request.targetId() == null || request.reason() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required fields are missing.");
    }

    ContentReport report = ContentReport.builder().reporter(reporter).targetType(request.targetType()).targetId(request.targetId()).reason(request.reason()).details(request.details()).status(ReportStatus.PENDING).build();

    return contentReportRepository.save(report);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<User> getUsers(String role, String status, String q, Pageable pageable) {
    UserRole roleEnum = null;
    if (role != null && !role.isBlank()) {
      try {
        roleEnum = UserRole.valueOf(role.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role filter.");
      }
    }

    String qVal = (q == null || q.isBlank()) ? null : q.trim();
    String statusVal = (status == null || status.isBlank()) ? null : status.toUpperCase();

    Page<User> users = userRepository.searchUsers(roleEnum, statusVal, qVal, LocalDateTime.now(), pageable);
    for (User u : users.getContent()) {
      if (u.getRole() == UserRole.RECRUITER) {
        List<CompanyMember> memberships = companyMemberRepository.findByUserId(u.getId());
        if (!memberships.isEmpty()) {
          String companyNames = memberships.stream().map(m -> m.getCompany().getName()).collect(Collectors.joining(", "));
          u.setAssociatedCompanyName(companyNames);
        }
      }
    }
    return users;
  }

  private List<Company> getCompaniesToCloseIfUserDeactivated(User user) {
    if (user.getRole() != UserRole.RECRUITER) {
      return Collections.emptyList();
    }
    List<CompanyMember> memberships = companyMemberRepository.findByUserId(user.getId());
    List<Company> companiesToClose = new ArrayList<>();
    LocalDateTime now = LocalDateTime.now();

    for (CompanyMember cm : memberships) {
      if (cm.getRole() == CompanyRole.OWNER) {
        Company company = cm.getCompany();
        if (company.getStatus() == CompanyStatus.ACTIVE) {
          List<CompanyMember> allOwners = companyMemberRepository.findByCompanyId(company.getId()).stream().filter(m -> m.getRole() == CompanyRole.OWNER).toList();

          boolean hasOtherActiveOwner = false;
          for (CompanyMember ownerMember : allOwners) {
            if (ownerMember.getUser().getId().equals(user.getId())) {
              continue;
            }
            User otherUser = ownerMember.getUser();
            boolean isBanned = otherUser.isBanned();
            boolean isSuspended = otherUser.getSuspensionExpiresAt() != null && otherUser.getSuspensionExpiresAt().isAfter(now);
            boolean isRecruiter = otherUser.getRole() == UserRole.RECRUITER;

            if (!isBanned && !isSuspended && isRecruiter) {
              hasOtherActiveOwner = true;
              break;
            }
          }

          if (!hasOtherActiveOwner) {
            companiesToClose.add(company);
          }
        }
      }
    }
    return companiesToClose;
  }

  @Override
  @Transactional(readOnly = true)
  public LastRecruiterCheckResponse checkLastRecruiter(Long id) {
    User user = userRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

    List<Company> toClose = getCompaniesToCloseIfUserDeactivated(user);
    List<LastRecruiterCheckResponse.CompanyInfo> companyInfos = toClose.stream().map(c -> new LastRecruiterCheckResponse.CompanyInfo(c.getId(), c.getName())).toList();

    return new LastRecruiterCheckResponse(!toClose.isEmpty(), companyInfos);
  }

  @Override
  @Transactional
  public User changeUserRole(Long id, UserRoleChangeRequest request) {
    User user = userRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

    if (user.getRole() == UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot change role of an admin.");
    }

    String newRoleStr = request.role();
    if (newRoleStr == null || newRoleStr.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is required.");
    }

    UserRole newRole;
    try {
      newRole = UserRole.valueOf(newRoleStr.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role value.");
    }

    UserRole oldRole = user.getRole();

    // If demoting from RECRUITER to something else, check and close company if last active owner
    if (oldRole == UserRole.RECRUITER && newRole != UserRole.RECRUITER) {
      List<Company> toClose = getCompaniesToCloseIfUserDeactivated(user);
      for (Company c : toClose) {
        c.setStatus(CompanyStatus.SUSPENDED);
        companyRepository.save(c);
      }

      // Delete their association in company_members so they are no longer linked
      List<CompanyMember> memberships = companyMemberRepository.findByUserId(user.getId());
      if (!memberships.isEmpty()) {
        companyMemberRepository.deleteAll(memberships);
      }
    }

    // If promoting to RECRUITER
    if (newRole == UserRole.RECRUITER) {
      Object companyIdObj = request.companyId();
      String companyName = request.companyName();

      if (companyIdObj == null && (companyName == null || companyName.isBlank())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either companyId or companyName is required when role is RECRUITER.");
      }

      List<CompanyMember> existingMemberships = companyMemberRepository.findByUserId(user.getId());

      if (companyIdObj != null) {
        Long companyId = null;
        if (companyIdObj instanceof Number) {
          companyId = ((Number) companyIdObj).longValue();
        } else {
          try {
            companyId = Long.parseLong(companyIdObj.toString());
          } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid companyId format.");
          }
        }

        final Long finalCompanyId = companyId;
        boolean alreadyMember = existingMemberships.stream().anyMatch(m -> m.getCompany().getId().equals(finalCompanyId));
        if (alreadyMember) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot switch to the company you are already in");
        }

        // Clean up any existing company membership for this user to satisfy uniqueness
        if (!existingMemberships.isEmpty()) {
          companyMemberRepository.deleteAll(existingMemberships);
          companyMemberRepository.flush();
        }

        Company company = companyRepository.findById(companyId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected company not found."));

        CompanyMember member = CompanyMember.builder().company(company).user(user).role(CompanyRole.OWNER).joinedAt(LocalDateTime.now()).build();
        companyMemberRepository.save(member);
      } else {
        companyName = companyName.trim();
        if (companyRepository.existsByName(companyName)) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company name already exists.");
        }

        // Clean up any existing company membership for this user to satisfy uniqueness
        if (!existingMemberships.isEmpty()) {
          companyMemberRepository.deleteAll(existingMemberships);
          companyMemberRepository.flush();
        }

        String slug = companyName.toLowerCase().replaceAll("[^a-z0-9\\s]", "").replaceAll("\\s+", "-").replaceAll("(^-|-$)", "");
        if (slug.isBlank()) {
          slug = "company-" + System.currentTimeMillis();
        }

        Company company = Company.builder().name(companyName).slug(slug).description("Công ty mới được tạo bởi Admin.").status(CompanyStatus.ACTIVE).createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now()).build();
        company = companyRepository.save(company);

        CompanyMember member = CompanyMember.builder().company(company).user(user).role(CompanyRole.OWNER).joinedAt(LocalDateTime.now()).build();
        companyMemberRepository.save(member);
      }
    }

    user.setRole(newRole);
    User saved = userRepository.save(user);

    // If role changed to RECRUITER, populate the company name for convenience in UI response
    if (newRole == UserRole.RECRUITER) {
      List<CompanyMember> memberships = companyMemberRepository.findByUserId(saved.getId());
      if (!memberships.isEmpty()) {
        String companyNames = memberships.stream().map(m -> m.getCompany().getName()).collect(Collectors.joining(", "));
        saved.setAssociatedCompanyName(companyNames);
      }
    }

    return saved;
  }

  @Override
  @Transactional
  public void suspendUser(User admin, Long id, UserSuspendRequest request) {
    User user = userRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

    if (user.getRole() == UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot suspend another admin.");
    }

    String reason = request.reason() != null ? request.reason() : "Violated community standards.";
    Integer days = request.days() != null ? request.days() : 7;

    List<Company> toClose = getCompaniesToCloseIfUserDeactivated(user);
    for (Company c : toClose) {
      c.setStatus(CompanyStatus.SUSPENDED);
      companyRepository.save(c);
    }

    LocalDateTime expiresAt = LocalDateTime.now().plusDays(days);
    user.setSuspensionExpiresAt(expiresAt);
    userRepository.save(user);

    ModerationAction action = ModerationAction.builder().admin(admin).targetUser(user).action(ActionType.SUSPEND).reason(reason).createdAt(LocalDateTime.now()).expiresAt(expiresAt).build();
    moderationActionRepository.save(action);
  }

  @Override
  @Transactional
  public void banUser(User admin, Long id, UserBanRequest request) {
    User user = userRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

    if (user.getRole() == UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot ban another admin.");
    }

    String reason = request.reason() != null ? request.reason() : "Violated community standards permanently.";

    List<Company> toClose = getCompaniesToCloseIfUserDeactivated(user);
    for (Company c : toClose) {
      c.setStatus(CompanyStatus.SUSPENDED);
      companyRepository.save(c);
    }

    user.setBanned(true);
    userRepository.save(user);

    ModerationAction action = ModerationAction.builder().admin(admin).targetUser(user).action(ActionType.BAN).reason(reason).createdAt(LocalDateTime.now()).build();
    moderationActionRepository.save(action);
  }

  @Override
  @Transactional
  public void unbanUser(User admin, Long id) {
    User user = userRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

    if (user.getRole() == UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot modify admin status.");
    }

    user.setBanned(false);
    user.setSuspensionExpiresAt(null);
    userRepository.save(user);

    ModerationAction action = ModerationAction.builder().admin(admin).targetUser(user).action(ActionType.UNBAN).reason("Ban/Suspension removed by admin.").createdAt(LocalDateTime.now()).build();
    moderationActionRepository.save(action);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ContentReport> getReports(String status, String targetType, Pageable pageable) {
    ReportStatus statusEnum = null;
    if (status != null && !status.isBlank()) {
      try {
        statusEnum = ReportStatus.valueOf(status.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status filter.");
      }
    }

    ReportTargetType typeEnum = null;
    if (targetType != null && !targetType.isBlank()) {
      try {
        typeEnum = ReportTargetType.valueOf(targetType.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid target type filter.");
      }
    }

    if (statusEnum != null && typeEnum != null) {
      return contentReportRepository.findByStatusAndTargetType(statusEnum, typeEnum, pageable);
    } else if (statusEnum != null) {
      return contentReportRepository.findByStatus(statusEnum, pageable);
    } else if (typeEnum != null) {
      return contentReportRepository.findByTargetType(typeEnum, pageable);
    } else {
      return contentReportRepository.findAll(pageable);
    }
  }

  @Override
  @Transactional
  public ContentReport reviewReport(User admin, Long id, ReportReviewRequest request) {
    ContentReport report = contentReportRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found."));

    String actionStr = request.action();
    String notes = request.notes() != null ? request.notes() : "";
    Integer suspensionDays = request.suspensionDays() != null ? request.suspensionDays() : 7;

    if (actionStr == null || actionStr.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Action is required.");
    }

    User targetAuthor = null;
    Post post = null;
    Comment comment = null;

    if (report.getTargetType() == ReportTargetType.POST) {
      post = postRepository.findById(report.getTargetId()).orElse(null);
      if (post != null) {
        targetAuthor = post.getAuthor();
      }
    } else if (report.getTargetType() == ReportTargetType.COMMENT) {
      comment = commentRepository.findById(report.getTargetId()).orElse(null);
      if (comment != null) {
        targetAuthor = comment.getAuthor();
      }
    } else if (report.getTargetType() == ReportTargetType.USER) {
      targetAuthor = userRepository.findById(report.getTargetId()).orElse(null);
    }

    if ("DISMISS".equalsIgnoreCase(actionStr)) {
      report.setStatus(ReportStatus.DISMISSED);
      if (post != null) {
        post.setHidden(false);
        postRepository.save(post);
      }
      if (comment != null) {
        comment.setHidden(false);
        commentRepository.save(comment);
      }
    } else {
      report.setStatus(ReportStatus.ACTION_TAKEN);

      if (post != null) {
        post.setHidden(true);
        postRepository.save(post);
      }
      if (comment != null) {
        comment.setHidden(true);
        commentRepository.save(comment);
      }

      ActionType actionType = null;
      LocalDateTime expiresAt = null;

      if ("BAN".equalsIgnoreCase(actionStr) && targetAuthor != null) {
        List<Company> toClose = getCompaniesToCloseIfUserDeactivated(targetAuthor);
        for (Company c : toClose) {
          c.setStatus(CompanyStatus.SUSPENDED);
          companyRepository.save(c);
        }
        targetAuthor.setBanned(true);
        userRepository.save(targetAuthor);
        actionType = ActionType.BAN;
      } else if ("SUSPEND".equalsIgnoreCase(actionStr) && targetAuthor != null) {
        List<Company> toClose = getCompaniesToCloseIfUserDeactivated(targetAuthor);
        for (Company c : toClose) {
          c.setStatus(CompanyStatus.SUSPENDED);
          companyRepository.save(c);
        }
        expiresAt = LocalDateTime.now().plusDays(suspensionDays);
        targetAuthor.setSuspensionExpiresAt(expiresAt);
        userRepository.save(targetAuthor);
        actionType = ActionType.SUSPEND;
      } else if ("REMOVE_CONTENT".equalsIgnoreCase(actionStr)) {
        actionType = ActionType.REMOVE_CONTENT;
      }

      if (actionType != null && targetAuthor != null) {
        ModerationAction modAction = ModerationAction.builder().admin(admin).targetUser(targetAuthor).action(actionType).reason(notes).targetContentId(report.getTargetId()).createdAt(LocalDateTime.now()).expiresAt(expiresAt).build();
        moderationActionRepository.save(modAction);
      }
    }

    report.setReviewedBy(admin);
    report.setReviewedAt(LocalDateTime.now());
    return contentReportRepository.save(report);
  }

  @Override
  @Transactional(readOnly = true)
  public AiUsageSummaryResponse getAiUsageSummary() {
    List<AIUsageLog> logs = aiUsageLogRepository.findAll();

    BigDecimal totalCost = BigDecimal.ZERO;
    long totalTokens = 0;
    long totalRequests = logs.size();

    Map<String, Long> requestsByType = new HashMap<>();
    Map<String, BigDecimal> costByType = new HashMap<>();

    for (AIUsageLog log : logs) {
      if (log.getEstimatedCostUsd() != null) {
        totalCost = totalCost.add(log.getEstimatedCostUsd());
      }
      if (log.getPromptTokens() != null) {
        totalTokens += log.getPromptTokens();
      }
      if (log.getCompletionTokens() != null) {
        totalTokens += log.getCompletionTokens();
      }

      String typeName = log.getUsageType().name();
      requestsByType.put(typeName, requestsByType.getOrDefault(typeName, 0L) + 1);

      BigDecimal cost = log.getEstimatedCostUsd() != null ? log.getEstimatedCostUsd() : BigDecimal.ZERO;
      costByType.put(typeName, costByType.getOrDefault(typeName, BigDecimal.ZERO).add(cost));
    }

    return new AiUsageSummaryResponse(totalCost, totalTokens, totalRequests, requestsByType, costByType);
  }

  @Override
  @Transactional(readOnly = true)
  public List<AiUsageTimeseriesPoint> getAiUsageTimeseries() {
    LocalDateTime thirtyDaysAgo = LocalDate.now().minusDays(30).atStartOfDay();
    List<AIUsageLog> logs = aiUsageLogRepository.findAll().stream().filter(log -> log.getUsedAt() != null && log.getUsedAt().isAfter(thirtyDaysAgo)).toList();

    Map<String, BigDecimal> dailyCosts = new TreeMap<>();
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    for (int i = 29; i >= 0; i--) {
      String dateStr = LocalDate.now().minusDays(i).format(formatter);
      dailyCosts.put(dateStr, BigDecimal.ZERO);
    }

    for (AIUsageLog log : logs) {
      String dateStr = log.getUsedAt().format(formatter);
      BigDecimal cost = log.getEstimatedCostUsd() != null ? log.getEstimatedCostUsd() : BigDecimal.ZERO;
      dailyCosts.put(dateStr, dailyCosts.getOrDefault(dateStr, BigDecimal.ZERO).add(cost));
    }

    List<AiUsageTimeseriesPoint> timeseries = new ArrayList<>();
    for (Map.Entry<String, BigDecimal> entry : dailyCosts.entrySet()) {
      timeseries.add(new AiUsageTimeseriesPoint(entry.getKey(), entry.getValue()));
    }

    return timeseries;
  }

  @Override
  @Transactional(readOnly = true)
  public OverviewStatsResponse getOverviewStats() {
    long usersCount = userRepository.count();
    long postsCount = postRepository.count();
    long jobsCount = jobRepository.count();
    long companiesCount = companyRepository.count();
    long eventsCount = eventRepository.count();
    long pendingCompanies = companyRepository.findAll().stream().filter(c -> c.getStatus() == com.hustlink.backend.features.companies.model.CompanyStatus.PENDING).count();
    long pendingReports = contentReportRepository.findAll().stream().filter(r -> r.getStatus() == ReportStatus.PENDING).count();

    return new OverviewStatsResponse(
            usersCount, postsCount, jobsCount, companiesCount, eventsCount, pendingCompanies, pendingReports
    );
  }
}
