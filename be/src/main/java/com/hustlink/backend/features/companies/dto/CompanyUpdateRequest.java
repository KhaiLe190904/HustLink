package com.hustlink.backend.features.companies.dto;

public record CompanyUpdateRequest(
                                   String description,
                                   String website,
                                   String industry,
                                   String size,
                                   String headquarters,
                                   String logoUrl,
                                   String coverUrl
) {
}
