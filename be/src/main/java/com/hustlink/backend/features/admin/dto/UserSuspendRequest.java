package com.hustlink.backend.features.admin.dto;

public record UserSuspendRequest(
                                 String reason,
                                 Integer days
) {
}
