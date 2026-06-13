package com.hustlink.backend.features.companies.repository;

import com.hustlink.backend.features.companies.model.CompanyMember;
import com.hustlink.backend.features.companies.model.CompanyRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CompanyMemberRepository extends JpaRepository<CompanyMember, Long> {
  Optional<CompanyMember> findByCompanyIdAndUserId(Long companyId, Long userId);

  List<CompanyMember> findByUserId(Long userId);

  List<CompanyMember> findByCompanyId(Long companyId);

  boolean existsByCompanyIdAndUserIdAndRole(Long companyId, Long userId, CompanyRole role);

  boolean existsByUserId(Long userId);
}
