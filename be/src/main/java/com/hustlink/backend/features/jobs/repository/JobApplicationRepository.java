package com.hustlink.backend.features.jobs.repository;

import com.hustlink.backend.features.jobs.model.JobApplication;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {
  List<JobApplication> findByJobId(Long jobId);

  List<JobApplication> findByApplicantId(Long applicantId);

  Optional<JobApplication> findByJobIdAndApplicantId(Long jobId, Long applicantId);

  boolean existsByJobIdAndApplicantId(Long jobId, Long applicantId);

  boolean existsByCvId(Long cvId);
}
