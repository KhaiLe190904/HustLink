package com.hustlink.backend.features.jobs.dto;

import com.hustlink.backend.features.jobs.model.Job;
import com.hustlink.backend.features.jobs.model.JobStatus;
import com.hustlink.backend.features.jobs.model.JobType;
import com.hustlink.backend.features.jobs.model.WorkMode;
import java.time.LocalDateTime;
import java.util.Set;

public record JobResponse(
                          Long id,
                          Long companyId,
                          String companyName,
                          String companyLogo,
                          String companySlug,
                          String title,
                          String description,
                          String requirements,
                          String responsibilities,
                          String location,
                          JobType jobType,
                          WorkMode workMode,
                          Integer salaryMin,
                          Integer salaryMax,
                          String salaryCurrency,
                          String experienceLevel,
                          Set<String> skills,
                          JobStatus status,
                          LocalDateTime createdAt,
                          LocalDateTime publishedAt,
                          LocalDateTime applicationDeadline,
                          String sourceType,
                          String sourceUrl,
                          String sourcePlatform,
                          Long assignedRecruiterId
) {
  public static JobResponse fromEntity(Job job) {
    return new JobResponse(
            job.getId(), job.getCompany().getId(), job.getCompany().getName(), job.getCompany().getLogoUrl(), job.getCompany().getSlug(), job.getTitle(), job.getDescription(), job.getRequirements(), job.getResponsibilities(), job.getLocation(), job.getJobType(), job.getWorkMode(), job.getSalaryMin(), job.getSalaryMax(), job.getSalaryCurrency(), job.getExperienceLevel(), job.getSkills(), job.getStatus(), job.getCreatedAt(), job.getPublishedAt(), job.getApplicationDeadline(), job.getSourceType(), job.getSourceUrl(), job.getSourcePlatform(), job.getAssignedRecruiter() == null ? null : job.getAssignedRecruiter().getId()
    );
  }
}
