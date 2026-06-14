package com.hustlink.backend.features.admin.dto;

import com.hustlink.backend.features.admin.model.ReportReason;
import com.hustlink.backend.features.admin.model.ReportTargetType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReportRequest(
                            @NotNull(message = "Target type must not be null") ReportTargetType targetType,
                            @NotNull(message = "Target ID must not be null") Long targetId,
                            @NotNull(message = "Reason must not be null") ReportReason reason,
                            @Size(max = 1000, message = "Details must not exceed 1000 characters") String details
) {
}
