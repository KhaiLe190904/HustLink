package com.hustlink.backend.features.jobs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.EmbeddingService;
import com.hustlink.backend.features.ai.embedding.VectorStoreClient;
import com.hustlink.backend.features.ai.embedding.dto.SimilarPoint;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyMember;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.companies.service.CompanyService;
import com.hustlink.backend.features.jobs.dto.*;
import com.hustlink.backend.features.jobs.model.*;
import com.hustlink.backend.features.jobs.repository.*;
import jakarta.transaction.Transactional;
import com.hustlink.backend.features.storage.service.ObjectStorageService;
import com.hustlink.backend.features.authentication.utils.EmailService;
import com.hustlink.backend.features.notifications.service.NotificationService;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobService {
  private final JobRepository jobRepository;
  private final JobApplicationRepository jobApplicationRepository;
  private final SavedJobRepository savedJobRepository;
  private final CompanyMemberRepository companyMemberRepository;
  private final CompanyService companyService;
  private final CVRepository cvRepository;
  private final JobMatchingService jobMatchingService;
  private final EmbeddingService embeddingService;
  private final VectorStoreClient vectorStoreClient;
  private final ObjectMapper objectMapper;
  private final ObjectStorageService objectStorageService;
  private final EmailService emailService;
  private final NotificationService notificationService;

  private static final String JOB_DESCRIPTION_COLLECTION = "job_description";

  public Job getJobEntity(Long id) {
    return jobRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
  }

  public JobResponse getJobDetail(Long id) {
    return JobResponse.fromEntity(getJobEntity(id));
  }

  @Transactional
  public JobResponse createJob(JobRequest request, User user) {
    if (user.getRole() != UserRole.RECRUITER) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only recruiters can create jobs");
    }

    if (request.applicationDeadline() != null && request.applicationDeadline().isBefore(LocalDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Application deadline cannot be in the past");
    }

    Company company = companyService.getMyCompany(user).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "You are not linked to any company"));

    Job job = Job.builder().company(company).postedBy(user).title(request.title()).description(request.description()).requirements(request.requirements()).responsibilities(request.responsibilities()).location(request.location()).jobType(request.jobType()).workMode(request.workMode()).salaryMin(request.salaryMin()).salaryMax(request.salaryMax()).salaryCurrency(request.salaryCurrency()).experienceLevel(request.experienceLevel()).skills(request.skills() != null ? request.skills() : new HashSet<>()).applicationDeadline(request.applicationDeadline()).status(JobStatus.DRAFT).build();

    Job savedJob = jobRepository.save(job);

    // Embed and upsert to Qdrant asynchronously/synchronously
    indexJobInVectorStore(savedJob);

    return JobResponse.fromEntity(savedJob);
  }

  @Transactional
  public JobResponse updateJob(Long id, JobRequest request, User user) {
    Job job = getJobEntity(id);
    validateJobOwner(job, user);

    job.setTitle(request.title());
    job.setDescription(request.description());
    job.setRequirements(request.requirements());
    job.setResponsibilities(request.responsibilities());
    job.setLocation(request.location());
    job.setJobType(request.jobType());
    job.setWorkMode(request.workMode());
    job.setSalaryMin(request.salaryMin());
    job.setSalaryMax(request.salaryMax());
    job.setSalaryCurrency(request.salaryCurrency());
    job.setExperienceLevel(request.experienceLevel());
    job.setSkills(request.skills() != null ? request.skills() : new HashSet<>());
    if (request.applicationDeadline() != null) {
      if (request.applicationDeadline().isBefore(LocalDateTime.now())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The application deadline cannot be in the past");
      }
      job.setApplicationDeadline(request.applicationDeadline());
    }

    Job savedJob = jobRepository.save(job);
    indexJobInVectorStore(savedJob);

    return JobResponse.fromEntity(savedJob);
  }

  @Transactional
  public JobResponse publishJob(Long id, User user) {
    Job job = getJobEntity(id);
    validateJobOwner(job, user);

    job.setStatus(JobStatus.PUBLISHED);
    job.setPublishedAt(LocalDateTime.now());
    Job savedJob = jobRepository.save(job);

    return JobResponse.fromEntity(savedJob);
  }

  @Transactional
  public JobResponse closeJob(Long id, User user) {
    Job job = getJobEntity(id);
    validateJobOwner(job, user);

    job.setStatus(JobStatus.CLOSED);
    job.setClosedAt(LocalDateTime.now());
    Job savedJob = jobRepository.save(job);

    return JobResponse.fromEntity(savedJob);
  }

  @Transactional
  public void deleteJob(Long id, User user) {
    Job job = getJobEntity(id);
    validateJobOwner(job, user);

    jobRepository.delete(job);
    try {
      vectorStoreClient.delete(JOB_DESCRIPTION_COLLECTION, job.getId().toString());
    } catch (Exception e) {
      log.warn("Failed to delete job vector from Qdrant: {}", e.getMessage());
    }
  }

  public List<JobResponse> getCompanyJobs(Long companyId, boolean includeDrafts, User user) {
    Company companyObj = companyService.getCompanyById(companyId);
    if (companyObj.getStatus() == com.hustlink.backend.features.companies.model.CompanyStatus.SUSPENDED) {
      boolean isOwnerOrAdmin = user != null && (user.getRole() == UserRole.ADMIN || companyMemberRepository.existsByCompanyIdAndUserIdAndRole(companyId, user.getId(), com.hustlink.backend.features.companies.model.CompanyRole.OWNER));
      if (!isOwnerOrAdmin) {
        return List.of();
      }
    }

    List<Job> jobs;
    if (includeDrafts) {
      Company company = companyService.getMyCompany(user).orElse(null);
      if (company != null && company.getId().equals(companyId)) {
        jobs = jobRepository.findByCompanyId(companyId);
      } else {
        jobs = jobRepository.findByCompanyIdAndStatus(companyId, JobStatus.PUBLISHED);
      }
    } else {
      jobs = jobRepository.findByCompanyIdAndStatus(companyId, JobStatus.PUBLISHED);
    }
    return jobs.stream().map(JobResponse::fromEntity).toList();
  }

  public List<JobResponse> getRecruiterJobs(User user) {
    Company company = companyService.getMyCompany(user).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "You are not linked to any company"));
    return jobRepository.findByCompanyId(company.getId()).stream().map(JobResponse::fromEntity).toList();
  }

  public Page<JobResponse> searchJobs(String query, String location, String skill, Integer minSalary, Pageable pageable) {
    List<Job> allActiveJobs = jobRepository.findByStatus(JobStatus.PUBLISHED);

    List<JobResponse> filtered = allActiveJobs.stream().filter(j -> {
      if (j.getCompany() != null && j.getCompany().getStatus() == com.hustlink.backend.features.companies.model.CompanyStatus.SUSPENDED) {
        return false;
      }
      if (j.getApplicationDeadline() != null && j.getApplicationDeadline().isBefore(LocalDateTime.now())) {
        return false;
      }
      if (query != null && !query.isBlank()) {
        String q = query.toLowerCase();
        boolean matchTitle = j.getTitle().toLowerCase().contains(q);
        boolean matchDesc = j.getDescription().toLowerCase().contains(q);
        boolean matchCompany = j.getCompany().getName().toLowerCase().contains(q);
        if (!matchTitle && !matchDesc && !matchCompany) {
          return false;
        }
      }
      if (location != null && !location.isBlank()) {
        if (j.getLocation() == null || !j.getLocation().toLowerCase().contains(location.toLowerCase())) {
          return false;
        }
      }
      if (skill != null && !skill.isBlank()) {
        boolean hasSkill = j.getSkills().stream().anyMatch(s -> s.toLowerCase().contains(skill.toLowerCase()));
        if (!hasSkill) {
          return false;
        }
      }
      if (minSalary != null) {
        if (j.getSalaryMax() != null && j.getSalaryMax() < minSalary) {
          return false;
        }
      }
      return true;
    }).map(JobResponse::fromEntity).toList();

    int start = (int) pageable.getOffset();
    int end = Math.min((start + pageable.getPageSize()), filtered.size());
    List<JobResponse> subList = start > filtered.size() ? List.of() : filtered.subList(start, end);
    return new PageImpl<>(subList, pageable, filtered.size());
  }

  @Transactional
  public JobApplicationResponse applyJob(Long jobId, JobApplicationRequest request, User user) {
    Job job = getJobEntity(jobId);
    if (job.getStatus() != JobStatus.PUBLISHED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This job is either closed or not published yet");
    }
    if (job.getCompany() != null && job.getCompany().getStatus() == com.hustlink.backend.features.companies.model.CompanyStatus.SUSPENDED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This job's company is currently closed/suspended");
    }

    if (job.getApplicationDeadline() != null && LocalDateTime.now().isAfter(job.getApplicationDeadline())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The application deadline for this job has already passed");
    }

    if (jobApplicationRepository.existsByJobIdAndApplicantId(jobId, user.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You have already applied for this job before");
    }

    CV cv = cvRepository.findByIdAndUserId(request.cvId(), user.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No valid CV found"));

    if (cv.getAnalysisScore() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This CV has not been analyzed yet. Please analyze the CV first.");
    }

    JobMatchingService.MatchResult matchResult = jobMatchingService.computeMatch(cv, job);

    JobApplication app = JobApplication.builder().job(job).applicant(user).cv(cv).coverLetter(request.coverLetter()).matchScore(matchResult.score()).matchBreakdown(matchResult.breakdown()).matchReasoning(matchResult.reasoning()).status(ApplicationStatus.APPLIED).build();

    JobApplication savedApp = jobApplicationRepository.save(app);

    try {
      List<CompanyMember> currentMembers = companyMemberRepository.findByCompanyId(job.getCompany().getId());
      boolean postedByStillMember = currentMembers.stream().anyMatch(member -> member.getUser().getId().equals(job.getPostedBy().getId()));

      if (postedByStillMember || currentMembers.isEmpty()) {
        notificationService.sendJobApplicationNotification(user, job.getPostedBy(), job.getId());
      } else {
        for (CompanyMember member : currentMembers) {
          notificationService.sendJobApplicationNotification(user, member.getUser(), job.getId());
        }
      }
    } catch (Exception e) {
      log.error("Failed to send job application notification", e);
    }

    return JobApplicationResponse.fromEntity(savedApp);
  }

  public List<JobApplicationResponse> getJobApplications(Long jobId, User user) {
    Job job = getJobEntity(jobId);
    validateJobOwner(job, user);

    return jobApplicationRepository.findByJobId(jobId).stream().sorted(Comparator.comparing(JobApplication::getMatchScore).reversed()).map(JobApplicationResponse::fromEntity).toList();
  }

  @Transactional
  public JobApplicationResponse updateApplicationStatus(Long appId, String statusStr, User user) {
    JobApplication app = jobApplicationRepository.findById(appId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

    validateJobOwner(app.getJob(), user);

    ApplicationStatus status;
    try {
      status = ApplicationStatus.valueOf(statusStr.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
    }

    if (status == ApplicationStatus.SHORTLISTED && app.getStatus() == ApplicationStatus.SHORTLISTED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The candidate has already been invited for an interview");
    }
    if (status == ApplicationStatus.REJECTED && app.getStatus() == ApplicationStatus.REJECTED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The candidate has already been rejected before");
    }

    app.setStatus(status);
    JobApplication savedApp = jobApplicationRepository.save(app);

    if (status == ApplicationStatus.SHORTLISTED) {
      try {
        String applicantEmail = app.getApplicant().getEmail();
        String applicantName = app.getApplicant().getFirstName() + " " + app.getApplicant().getLastName();
        String jobTitle = app.getJob().getTitle();
        String companyName = app.getJob().getCompany().getName();
        String subject = "[HustLink] Thư mời phỏng vấn - " + jobTitle;
        String content = "<h3>Xin chào " + applicantName + ",</h3>" + "<p>Chúng tôi rất ấn tượng với hồ sơ của bạn cho vị trí <strong>" + jobTitle + "</strong> tại <strong>" + companyName + "</strong>.</p>" + "<p>Chúng tôi trân trọng kính mời bạn tham gia một buổi phỏng vấn để trao đổi thêm về kinh nghiệm và sự phù hợp của bạn cho vị trí này.</p>" + "<p>Đại diện tuyển dụng của chúng tôi sẽ liên hệ với bạn qua email này hoặc số điện thoại của bạn để sắp xếp lịch phỏng vấn cụ thể.</p>" + "<br/>" + "<p>Trân trọng,</p>" + "<p>Đội ngũ tuyển dụng " + companyName + "</p>";
        emailService.sendEmail(applicantEmail, subject, content);
      } catch (Exception e) {
        log.error("Failed to send interview invitation email via Resend", e);
      }
    }

    return JobApplicationResponse.fromEntity(savedApp);
  }

  public String getCvDownloadUrl(Long appId, User user) {
    JobApplication app = jobApplicationRepository.findById(appId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    validateJobOwner(app.getJob(), user);
    if (app.getCv() == null || app.getCv().getStoredObject() == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No CV file found");
    }
    return objectStorageService.getAccessUrl(app.getCv().getStoredObject());
  }

  public List<JobResponse> getRecommendedJobs(User user) {
    List<CV> userCvs = cvRepository.findByUserIdOrderByUploadedAtDesc(user.getId());
    if (userCvs.isEmpty()) {
      return List.of();
    }
    CV latestCv = userCvs.getFirst();
    if (latestCv.getAnalysisScore() == null) {
      return List.of();
    }

    try {
      float[] cvVector = embeddingService.embed(latestCv.getExtractedText());
      List<SimilarPoint> similarPoints = vectorStoreClient.search(JOB_DESCRIPTION_COLLECTION, cvVector, 10, Map.of());

      List<Long> ids = similarPoints.stream().map(point -> {
        try {
          return Long.parseLong(point.id());
        } catch (NumberFormatException e) {
          return null;
        }
      }).filter(Objects::nonNull).toList();

      if (ids.isEmpty()) {
        return List.of();
      }

      List<Job> jobs = jobRepository.findAllById(ids);
      Map<Long, Job> jobMap = jobs.stream().collect(Collectors.toMap(Job::getId, j -> j));
      return ids.stream().map(jobMap::get).filter(Objects::nonNull).filter(j -> j.getStatus() == JobStatus.PUBLISHED).map(JobResponse::fromEntity).toList();
    } catch (Exception e) {
      log.warn("Failed to retrieve recommendations from Qdrant: {}. Falling back to default list.", e.getMessage());
      return jobRepository.findByStatus(JobStatus.PUBLISHED).stream().limit(10).map(JobResponse::fromEntity).toList();
    }
  }

  @Transactional
  public void saveJob(Long jobId, User user) {
    Job job = getJobEntity(jobId);
    if (savedJobRepository.existsByUserIdAndJobId(user.getId(), jobId)) {
      return;
    }
    SavedJob savedJob = SavedJob.builder().user(user).job(job).build();
    savedJobRepository.save(savedJob);
  }

  @Transactional
  public void unsaveJob(Long jobId, User user) {
    savedJobRepository.findByUserIdAndJobId(user.getId(), jobId).ifPresent(savedJobRepository::delete);
  }

  public List<JobResponse> getSavedJobs(User user) {
    return savedJobRepository.findByUserId(user.getId()).stream().map(sj -> JobResponse.fromEntity(sj.getJob())).toList();
  }

  public List<JobApplicationResponse> getMyApplications(User user) {
    return jobApplicationRepository.findByApplicantId(user.getId()).stream().map(JobApplicationResponse::fromEntity).toList();
  }

  @Transactional
  public int reindexAllJobsInVectorStore() {
    vectorStoreClient.ensureCollection(JOB_DESCRIPTION_COLLECTION, embeddingService.dimension());
    int indexedCount = 0;

    for (Job job : jobRepository.findAll()) {
      if (indexJobInVectorStore(job)) {
        indexedCount++;
      }
    }

    return indexedCount;
  }

  private void validateJobOwner(Job job, User user) {
    if (user.getRole() == UserRole.RECRUITER) {
      Company recruiterCompany = companyService.getMyCompany(user).orElse(null);
      if (recruiterCompany != null && job.getCompany() != null && job.getCompany().getId().equals(recruiterCompany.getId())) {
        return;
      }
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to manage this job posting");
  }

  private boolean indexJobInVectorStore(Job job) {
    try {
      float[] vector = embeddingService.embed(job.getTitle() + "\n" + job.getDescription());
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("jobId", job.getId());
      payload.put("companyId", job.getCompany().getId());
      payload.put("title", job.getTitle());
      payload.put("skills", new ArrayList<>(job.getSkills()));

      vectorStoreClient.upsert(JOB_DESCRIPTION_COLLECTION, job.getId().toString(), vector, payload);
      job.setVectorId(job.getId().toString());
      jobRepository.save(job);
      return true;
    } catch (Exception e) {
      log.warn("Failed to index job in Qdrant: {}", e.getMessage());
      return false;
    }
  }
}
