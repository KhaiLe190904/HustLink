package com.hustlink.backend.features.jobs.repository;

import com.hustlink.backend.features.jobs.model.Job;
import com.hustlink.backend.features.jobs.model.JobStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {
  List<Job> findByCompanyIdAndStatus(Long companyId, JobStatus status);

  List<Job> findByCompanyId(Long companyId);

  List<Job> findByPostedById(Long userId);

  List<Job> findByStatus(JobStatus status);

  List<Job> findBySourceTypeIsNotNullAndStatus(JobStatus status);

  List<Job> findBySourceTypeIsNotNullOrderByCreatedAtDesc();

  long countByCompanyId(Long companyId);

  Optional<Job> findFirstBySourcePlatformAndExternalJobId(String sourcePlatform, String externalJobId);

  Optional<Job> findFirstBySourceUrl(String sourceUrl);
}
