package com.hustlink.backend.features.companies.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.companies.dto.CompanyRegisterRequest;
import com.hustlink.backend.features.companies.dto.CompanyUpdateRequest;
import com.hustlink.backend.features.companies.model.*;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.companies.repository.CompanyRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CompanyService {
  private final CompanyRepository companyRepository;
  private final CompanyMemberRepository companyMemberRepository;
  private final UserRepository userRepository;

  public Company getCompanyById(Long id) {
    return companyRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));
  }

  public Company getCompanyBySlug(String slug) {
    return companyRepository.findBySlug(slug).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));
  }

  public List<Company> getPendingCompanies() {
    return companyRepository.findByStatus(CompanyStatus.PENDING);
  }

  public List<Company> getActiveCompanies() {
    return companyRepository.findByStatus(CompanyStatus.ACTIVE);
  }

  @Transactional
  public Company registerCompany(CompanyRegisterRequest request, User user) {
    if (companyMemberRepository.existsByUserId(user.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already own or belong to a company");
    }

    if (companyRepository.existsByName(request.name())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company name already exists");
    }

    String slug = request.name().toLowerCase().replaceAll("[^a-z0-9\\s]", "").replaceAll("\\s+", "-").replaceAll("(^-|-$)", "");

    if (slug.isBlank()) {
      slug = "company-" + System.currentTimeMillis();
    }

    Company company = Company.builder().name(request.name()).slug(slug).description(request.description()).website(request.website()).industry(request.industry()).size(request.size()).headquarters(request.headquarters()).status(CompanyStatus.PENDING).build();

    Company savedCompany = companyRepository.save(company);

    CompanyMember member = CompanyMember.builder().company(savedCompany).user(user).role(CompanyRole.OWNER).build();

    companyMemberRepository.save(member);

    return savedCompany;
  }

  @Transactional
  public Company approveCompany(Long companyId) {
    Company company = getCompanyById(companyId);
    if (company.getStatus() != CompanyStatus.PENDING && company.getStatus() != CompanyStatus.SUSPENDED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company is not pending or suspended");
    }

    company.setStatus(CompanyStatus.ACTIVE);
    Company savedCompany = companyRepository.save(company);

    // Tìm Owner và nâng cấp role thành RECRUITER
    List<CompanyMember> members = companyMemberRepository.findByCompanyId(companyId);
    for (CompanyMember member : members) {
      if (member.getRole() == CompanyRole.OWNER) {
        User user = member.getUser();
        user.setRole(UserRole.RECRUITER);
        userRepository.save(user);
      }
    }

    return savedCompany;
  }

  @Transactional
  public Company rejectCompany(Long companyId) {
    Company company = getCompanyById(companyId);
    if (company.getStatus() != CompanyStatus.PENDING) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company is not pending approval");
    }

    List<CompanyMember> members = companyMemberRepository.findByCompanyId(companyId);
    companyMemberRepository.deleteAll(members);

    companyRepository.delete(company);
    return company;
  }

  @Transactional
  public Company updateCompany(Long companyId, CompanyUpdateRequest request, User user) {
    Company company = getCompanyById(companyId);

    // Kiểm tra quyền OWNER
    boolean isOwner = companyMemberRepository.existsByCompanyIdAndUserIdAndRole(companyId, user.getId(), CompanyRole.OWNER);
    if (!isOwner && user.getRole() != UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not allowed to update this company");
    }

    if (request.description() != null) company.setDescription(request.description());
    if (request.website() != null) company.setWebsite(request.website());
    if (request.industry() != null) company.setIndustry(request.industry());
    if (request.size() != null) company.setSize(request.size());
    if (request.headquarters() != null) company.setHeadquarters(request.headquarters());
    if (request.logoUrl() != null) company.setLogoUrl(request.logoUrl());
    if (request.coverUrl() != null) company.setCoverUrl(request.coverUrl());

    return companyRepository.save(company);
  }

  public List<User> getAlumniInCompany(Long companyId) {
    Company company = getCompanyById(companyId);
    return userRepository.findAll().stream().filter(u -> u.getCompany() != null && u.getCompany().equalsIgnoreCase(company.getName())).toList();
  }

  public Optional<Company> getMyCompany(User user) {
    List<CompanyMember> memberships = companyMemberRepository.findByUserId(user.getId());
    if (memberships.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(memberships.getFirst().getCompany());
  }

  public Page<Company> getCompaniesPaged(String status, String query, Pageable pageable) {
    CompanyStatus companyStatus = null;
    if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
      try {
        companyStatus = CompanyStatus.valueOf(status.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid company status");
      }
    }

    boolean hasQuery = query != null && !query.isBlank();
    if (companyStatus != null) {
      if (hasQuery) {
        return companyRepository.findByStatusAndNameContainingIgnoreCase(companyStatus, query.trim(), pageable);
      } else {
        return companyRepository.findByStatus(companyStatus, pageable);
      }
    } else {
      if (hasQuery) {
        return companyRepository.findByNameContainingIgnoreCase(query.trim(), pageable);
      } else {
        return companyRepository.findAll(pageable);
      }
    }
  }

  @Transactional
  public void closeCompany(Long companyId, User user) {
    Company company = getCompanyById(companyId);

    // Check if the user is OWNER of this company or an ADMIN
    boolean isOwner = companyMemberRepository.existsByCompanyIdAndUserIdAndRole(companyId, user.getId(), CompanyRole.OWNER);
    if (!isOwner && user.getRole() != UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to close this company");
    }

    // Set recruiter roles back to USER
    List<CompanyMember> members = companyMemberRepository.findByCompanyId(companyId);
    for (CompanyMember member : members) {
      if (member.getRole() == CompanyRole.OWNER) {
        User u = member.getUser();
        if (u.getRole() == UserRole.RECRUITER) {
          u.setRole(UserRole.USER);
          userRepository.save(u);
        }
      }
    }

    // Set status to SUSPENDED instead of deleting
    company.setStatus(CompanyStatus.SUSPENDED);
    companyRepository.save(company);
  }

  @Transactional
  public Company reopenCompany(Long companyId, User user) {
    Company company = getCompanyById(companyId);

    // Check if the user is OWNER of this company or an ADMIN
    boolean isOwner = companyMemberRepository.existsByCompanyIdAndUserIdAndRole(companyId, user.getId(), CompanyRole.OWNER);
    if (!isOwner && user.getRole() != UserRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to reopen this company");
    }

    if (company.getStatus() != CompanyStatus.SUSPENDED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company is not suspended");
    }

    company.setStatus(CompanyStatus.ACTIVE);
    Company savedCompany = companyRepository.save(company);

    // Restore recruiter role for OWNER
    List<CompanyMember> members = companyMemberRepository.findByCompanyId(companyId);
    for (CompanyMember member : members) {
      if (member.getRole() == CompanyRole.OWNER) {
        User u = member.getUser();
        u.setRole(UserRole.RECRUITER);
        userRepository.save(u);
      }
    }

    return savedCompany;
  }
}
