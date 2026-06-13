package com.hustlink.backend.features.companies.dto;

import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import java.time.LocalDateTime;

public record CompanyResponse(
                              Long id,
                              String name,
                              String slug,
                              String description,
                              String website,
                              String industry,
                              String size,
                              String headquarters,
                              String logoUrl,
                              String coverUrl,
                              CompanyStatus status,
                              LocalDateTime createdAt
) {
  public static CompanyResponse fromEntity(Company company) {
    return new CompanyResponse(
            company.getId(), company.getName(), company.getSlug(), company.getDescription(), company.getWebsite(), company.getIndustry(), company.getSize(), company.getHeadquarters(), company.getLogoUrl(), company.getCoverUrl(), company.getStatus(), company.getCreatedAt()
    );
  }
}
