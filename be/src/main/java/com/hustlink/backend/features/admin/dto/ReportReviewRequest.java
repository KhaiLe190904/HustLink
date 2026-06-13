package com.hustlink.backend.features.admin.dto;

public record ReportReviewRequest(
                                  String action,
                                  String notes,
                                  Integer suspensionDays
) {
}
