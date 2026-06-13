package com.hustlink.backend.features.admin.dto;

import com.hustlink.backend.features.admin.model.ReportReason;
import com.hustlink.backend.features.admin.model.ReportTargetType;

public record ReportRequest(
                            ReportTargetType targetType,
                            Long targetId,
                            ReportReason reason,
                            String details
) {
}
