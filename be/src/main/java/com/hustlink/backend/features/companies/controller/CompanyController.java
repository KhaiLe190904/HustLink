package com.hustlink.backend.features.companies.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.security.RequireRole;
import com.hustlink.backend.features.companies.dto.*;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import com.hustlink.backend.features.companies.service.CompanyService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CompanyController {
  private final CompanyService companyService;

  @PostMapping("/companies")
  public ResponseEntity<CompanyResponse> registerCompany(
                                                         @Valid @RequestBody CompanyRegisterRequest request, @RequestAttribute("authenticationUser") User user) {
    Company company = companyService.registerCompany(request, user);
    return ResponseEntity.ok(CompanyResponse.fromEntity(company));
  }

  @GetMapping("/companies/{slug}")
  public ResponseEntity<CompanyResponse> getCompanyBySlug(@PathVariable String slug) {
    Company company = companyService.getCompanyBySlug(slug);
    return ResponseEntity.ok(CompanyResponse.fromEntity(company));
  }

  @GetMapping("/companies/my")
  public ResponseEntity<CompanyResponse> getMyCompany(@RequestAttribute("authenticationUser") User user) {
    return companyService.getMyCompany(user).map(c -> ResponseEntity.ok(CompanyResponse.fromEntity(c))).orElse(ResponseEntity.noContent().build());
  }

  @PatchMapping("/companies/{id}")
  public ResponseEntity<CompanyResponse> updateCompany(
                                                       @PathVariable Long id, @Valid @RequestBody CompanyUpdateRequest request, @RequestAttribute("authenticationUser") User user) {
    Company company = companyService.updateCompany(id, request, user);
    return ResponseEntity.ok(CompanyResponse.fromEntity(company));
  }

  @GetMapping("/companies/{id}/people")
  public ResponseEntity<List<User>> getCompanyPeople(@PathVariable Long id) {
    List<User> people = companyService.getAlumniInCompany(id);
    return ResponseEntity.ok(people);
  }

  // Admin Endpoints
  @GetMapping("/admin/companies")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<List<CompanyResponse>> getPendingCompanies(
                                                                   @RequestParam(required = false, defaultValue = "PENDING") String status) {
    CompanyStatus companyStatus;
    try {
      companyStatus = CompanyStatus.valueOf(status.toUpperCase());
    } catch (IllegalArgumentException e) {
      companyStatus = CompanyStatus.PENDING;
    }
    List<Company> companies = companyService.getCompaniesByStatus(companyStatus);
    return ResponseEntity.ok(companies.stream().map(CompanyResponse::fromEntity).toList());
  }

  @PatchMapping("/admin/companies/{id}/approve")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<CompanyResponse> approveCompany(@PathVariable Long id) {
    Company company = companyService.approveCompany(id);
    return ResponseEntity.ok(CompanyResponse.fromEntity(company));
  }

  @PatchMapping("/admin/companies/{id}/reject")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Void> rejectCompany(@PathVariable Long id) {
    companyService.rejectCompany(id);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/admin/companies/paged")
  @RequireRole(UserRole.ADMIN)
  public ResponseEntity<Page<CompanyResponse>> getCompaniesPaged(
                                                                 @RequestParam(required = false) String status, @RequestParam(required = false) String q, @PageableDefault(size = 8) Pageable pageable) {
    Page<Company> companies = companyService.getCompaniesPaged(status, q, pageable);
    return ResponseEntity.ok(companies.map(CompanyResponse::fromEntity));
  }

  @DeleteMapping("/companies/{id}")
  public ResponseEntity<Void> closeCompany(
                                           @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    companyService.closeCompany(id, user);
    return ResponseEntity.ok().build();
  }

  @PatchMapping("/companies/{id}/reopen")
  public ResponseEntity<CompanyResponse> reopenCompany(
                                                       @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    Company company = companyService.reopenCompany(id, user);
    return ResponseEntity.ok(CompanyResponse.fromEntity(company));
  }
}
