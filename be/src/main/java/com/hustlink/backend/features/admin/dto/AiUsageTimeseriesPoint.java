package com.hustlink.backend.features.admin.dto;

import java.math.BigDecimal;

public record AiUsageTimeseriesPoint(
                                     String date,
                                     BigDecimal cost
) {
}
