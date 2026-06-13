package com.hustlink.backend.features.admin.dto;

import java.util.List;

public record LastRecruiterCheckResponse(
                                         boolean isLastRecruiter,
                                         List<CompanyInfo> companies
) {
  public record CompanyInfo(Long id, String name) {
  }
}
