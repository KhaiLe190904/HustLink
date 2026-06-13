package com.hustlink.backend.features.events.dto;

import com.hustlink.backend.features.events.model.EventMode;
import com.hustlink.backend.features.events.model.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.Set;

public record EventRequest(
                           @NotBlank(message = "Tiêu đề không được bỏ trống") String title,

                           @NotBlank(message = "Mô tả không được bỏ trống") String description,

                           @NotNull(message = "Thời gian bắt đầu không được bỏ trống") LocalDateTime startAt,

                           @NotNull(message = "Thời gian kết thúc không được bỏ trống") LocalDateTime endAt,

                           @NotNull(message = "Hình thức không được bỏ trống") EventMode mode,

                           String onlineLink,
                           String venue,
                           String cityCode,
                           Integer capacity,
                           String coverImageUrl,
                           Long hostCompanyId,
                           EventType type,
                           Set<String> tags
) {
}
