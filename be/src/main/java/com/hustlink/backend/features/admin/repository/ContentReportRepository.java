package com.hustlink.backend.features.admin.repository;

import com.hustlink.backend.features.admin.model.ContentReport;
import com.hustlink.backend.features.admin.model.ReportStatus;
import com.hustlink.backend.features.admin.model.ReportTargetType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {
  Page<ContentReport> findByStatus(ReportStatus status, Pageable pageable);

  Page<ContentReport> findByTargetType(ReportTargetType targetType, Pageable pageable);

  Page<ContentReport> findByStatusAndTargetType(ReportStatus status, ReportTargetType targetType, Pageable pageable);

  List<ContentReport> findByTargetTypeAndTargetId(ReportTargetType targetType, Long targetId);
}
