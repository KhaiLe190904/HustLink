package com.hustlink.backend.features.jobs.dto;

import com.hustlink.backend.features.jobs.model.ApplicationStatus;
import com.hustlink.backend.features.jobs.model.JobApplication;
import java.time.LocalDateTime;

public record JobApplicationResponse(
                                     Long id,
                                     Long jobId,
                                     String jobTitle,
                                     String companyName,
                                     Long applicantId,
                                     String applicantName,
                                     String applicantEmail,
                                     Long cvId,
                                     String cvFileName,
                                     String coverLetter,
                                     Integer matchScore,
                                     String matchBreakdown,
                                     String matchReasoning,
                                     ApplicationStatus status,
                                     LocalDateTime appliedAt
) {
  public static JobApplicationResponse fromEntity(JobApplication app) {
    String applicantName = app.getApplicant().getFirstName() + " " + app.getApplicant().getLastName();
    return new JobApplicationResponse(
            app.getId(), app.getJob().getId(), app.getJob().getTitle(), app.getJob().getCompany().getName(), app.getApplicant().getId(), applicantName.trim(), app.getApplicant().getEmail(), app.getCv().getId(), app.getCv().getOriginalFileName(), app.getCoverLetter(), app.getMatchScore(), app.getMatchBreakdown(), app.getMatchReasoning(), app.getStatus(), app.getAppliedAt()
    );
  }
}
