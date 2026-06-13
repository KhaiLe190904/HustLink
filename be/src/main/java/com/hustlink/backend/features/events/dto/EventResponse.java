package com.hustlink.backend.features.events.dto;

import com.hustlink.backend.features.events.model.*;
import java.time.LocalDateTime;
import java.util.Set;

public record EventResponse(
                            Long id,
                            Long organizerId,
                            String organizerName,
                            Long hostCompanyId,
                            String hostCompanyName,
                            String hostCompanyLogo,
                            String hostCompanySlug,
                            EventType type,
                            String title,
                            String description,
                            LocalDateTime startAt,
                            LocalDateTime endAt,
                            EventMode mode,
                            String onlineLink,
                            String venue,
                            String cityCode,
                            Integer capacity,
                            String coverImageUrl,
                            EventStatus status,
                            Set<String> tags,
                            LocalDateTime createdAt,
                            long goingCount,
                            long interestedCount
) {
  public static EventResponse fromEntity(Event event, long goingCount, long interestedCount) {
    String organizerName = event.getOrganizer().getFirstName() + " " + event.getOrganizer().getLastName();
    return new EventResponse(
            event.getId(), event.getOrganizer().getId(), organizerName.trim(), event.getHostCompany() != null ? event.getHostCompany().getId() : null, event.getHostCompany() != null ? event.getHostCompany().getName() : null, event.getHostCompany() != null ? event.getHostCompany().getLogoUrl() : null, event.getHostCompany() != null ? event.getHostCompany().getSlug() : null, event.getType(), event.getTitle(), event.getDescription(), event.getStartAt(), event.getEndAt(), event.getMode(), event.getOnlineLink(), event.getVenue(), event.getCityCode(), event.getCapacity(), event.getCoverImageUrl(), event.getStatus(), event.getTags(), event.getCreatedAt(), goingCount, interestedCount
    );
  }
}
