package com.hustlink.backend.features.admin.repository;

import com.hustlink.backend.features.admin.model.ModerationAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ModerationActionRepository extends JpaRepository<ModerationAction, Long> {
  List<ModerationAction> findByTargetUserId(Long targetUserId);

  Page<ModerationAction> findByTargetUserId(Long targetUserId, Pageable pageable);
}
