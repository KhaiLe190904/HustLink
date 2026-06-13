package com.hustlink.backend.features.admin.dto;

public record UserRoleChangeRequest(
                                    String role,
                                    Object companyId,
                                    String companyName
) {
}
