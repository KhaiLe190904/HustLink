package com.hustlink.backend.features.companies.repository;

import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {
  Optional<Company> findBySlug(String slug);

  List<Company> findByStatus(CompanyStatus status);

  boolean existsByName(String name);

  Page<Company> findByStatus(CompanyStatus status, Pageable pageable);

  Page<Company> findByNameContainingIgnoreCase(String name, Pageable pageable);

  Page<Company> findByStatusAndNameContainingIgnoreCase(CompanyStatus status, String name, Pageable pageable);
}
