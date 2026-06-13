package com.hustlink.backend.features.events.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyRole;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.companies.service.CompanyService;
import com.hustlink.backend.features.events.dto.*;
import com.hustlink.backend.features.events.model.*;
import com.hustlink.backend.features.events.repository.EventRepository;
import com.hustlink.backend.features.events.repository.EventRsvpRepository;
import com.hustlink.backend.features.notifications.model.NotificationType;
import com.hustlink.backend.features.notifications.repository.NotificationRepository;
import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@Service
@Slf4j
@RequiredArgsConstructor
public class EventService {
  private final EventRepository eventRepository;
  private final EventRsvpRepository eventRsvpRepository;
  private final CompanyService companyService;
  private final NotificationRepository notificationRepository;
  private final CompanyMemberRepository companyMemberRepository;

  public Event getEventEntity(Long id) {
    return eventRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sự kiện"));
  }

  public EventResponse getEventDetail(Long id) {
    Event event = getEventEntity(id);
    long going = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.GOING);
    long interested = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.INTERESTED);
    return EventResponse.fromEntity(event, going, interested);
  }

  @Transactional
  public EventResponse createEvent(EventRequest request, User user) {
    if (request.startAt().isBefore(LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(5))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian bắt đầu không được ở trong quá khứ");
    }
    if (!request.endAt().isAfter(request.startAt())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian kết thúc phải sau thời gian bắt đầu");
    }

    Company hostCompany = null;
    if (request.hostCompanyId() != null) {
      hostCompany = companyService.getCompanyById(request.hostCompanyId());
    }

    Event event = Event.builder().organizer(user).hostCompany(hostCompany).type(request.type() != null ? request.type() : EventType.TALK_SHOW).title(request.title()).description(request.description()).startAt(request.startAt()).endAt(request.endAt()).mode(request.mode() != null ? request.mode() : EventMode.OFFLINE).onlineLink(request.onlineLink()).venue(request.venue()).cityCode(request.cityCode()).capacity(request.capacity()).coverImageUrl(request.coverImageUrl()).status(EventStatus.DRAFT).tags(request.tags() != null ? request.tags() : new HashSet<>()).build();

    Event savedEvent = eventRepository.save(event);
    return EventResponse.fromEntity(savedEvent, 0, 0);
  }

  @Transactional
  public EventResponse updateEvent(Long id, EventRequest request, User user) {
    Event event = getEventEntity(id);
    validateEventOwner(event, user);

    if (!event.getStartAt().equals(request.startAt()) && request.startAt().isBefore(LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(5))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian bắt đầu không được ở trong quá khứ");
    }
    if (!request.endAt().isAfter(request.startAt())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian kết thúc phải sau thời gian bắt đầu");
    }

    Company hostCompany = null;
    if (request.hostCompanyId() != null) {
      hostCompany = companyService.getCompanyById(request.hostCompanyId());
    }

    event.setHostCompany(hostCompany);
    event.setType(request.type() != null ? request.type() : EventType.TALK_SHOW);
    event.setTitle(request.title());
    event.setDescription(request.description());
    event.setStartAt(request.startAt());
    event.setEndAt(request.endAt());
    event.setMode(request.mode() != null ? request.mode() : EventMode.OFFLINE);
    event.setOnlineLink(request.onlineLink());
    event.setVenue(request.venue());
    event.setCityCode(request.cityCode());
    event.setCapacity(request.capacity());
    event.setCoverImageUrl(request.coverImageUrl());
    event.setTags(request.tags() != null ? request.tags() : new HashSet<>());

    Event savedEvent = eventRepository.save(event);
    long going = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.GOING);
    long interested = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.INTERESTED);
    return EventResponse.fromEntity(savedEvent, going, interested);
  }

  @Transactional
  public EventResponse publishEvent(Long id, User user) {
    Event event = getEventEntity(id);
    validateEventOwner(event, user);

    event.setStatus(EventStatus.PUBLISHED);
    Event savedEvent = eventRepository.save(event);
    long going = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.GOING);
    long interested = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.INTERESTED);
    return EventResponse.fromEntity(savedEvent, going, interested);
  }

  @Transactional
  public EventResponse cancelEvent(Long id, User user) {
    Event event = getEventEntity(id);
    validateEventOwner(event, user);

    event.setStatus(EventStatus.CANCELLED);
    Event savedEvent = eventRepository.save(event);
    long going = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.GOING);
    long interested = eventRsvpRepository.countByEventIdAndStatus(id, RsvpStatus.INTERESTED);
    return EventResponse.fromEntity(savedEvent, going, interested);
  }

  @Transactional
  public void deleteEvent(Long id, User user) {
    Event event = getEventEntity(id);
    validateEventOwner(event, user);
    eventRsvpRepository.deleteByEventId(id);
    notificationRepository.deleteByResourceIdAndType(id, NotificationType.EVENT_REMINDER);
    eventRepository.delete(event);
  }

  @Transactional
  public void rsvpEvent(Long id, String statusStr, User user) {
    Event event = getEventEntity(id);
    if (event.getStatus() != EventStatus.PUBLISHED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sự kiện chưa được công bố hoặc đã bị hủy");
    }
    if (event.getHostCompany() != null && event.getHostCompany().getStatus() == CompanyStatus.SUSPENDED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Công ty tổ chức sự kiện này đang bị tạm dừng hoạt động");
    }

    RsvpStatus status;
    try {
      status = RsvpStatus.valueOf(statusStr.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái RSVP không hợp lệ");
    }

    Optional<EventRsvp> existing = eventRsvpRepository.findByEventIdAndUserId(id, user.getId());
    if (existing.isPresent()) {
      EventRsvp rsvp = existing.get();
      rsvp.setStatus(status);
      eventRsvpRepository.save(rsvp);
    } else {
      EventRsvp rsvp = EventRsvp.builder().event(event).user(user).status(status).build();
      eventRsvpRepository.save(rsvp);
    }
  }

  @Transactional
  public void cancelRsvp(Long id, User user) {
    eventRsvpRepository.findByEventIdAndUserId(id, user.getId()).ifPresent(eventRsvpRepository::delete);
  }

  public Page<EventResponse> searchEvents(String query, String type, String city, Boolean upcoming, Pageable pageable) {
    List<Event> events = eventRepository.findByStatus(EventStatus.PUBLISHED);

    List<EventResponse> filtered = events.stream().filter(e -> {
      if (e.getHostCompany() != null && e.getHostCompany().getStatus() == CompanyStatus.SUSPENDED) {
        return false;
      }
      if (query != null && !query.isBlank()) {
        String q = query.toLowerCase();
        boolean matchTitle = e.getTitle().toLowerCase().contains(q);
        boolean matchDesc = e.getDescription().toLowerCase().contains(q);
        if (!matchTitle && !matchDesc) {
          return false;
        }
      }
      if (type != null && !type.isBlank()) {
        if (!e.getType().name().equalsIgnoreCase(type)) {
          return false;
        }
      }
      if (city != null && !city.isBlank()) {
        if (e.getCityCode() == null || !e.getCityCode().equalsIgnoreCase(city)) {
          return false;
        }
      }
      if (upcoming != null) {
        boolean isUpcoming = e.getStartAt().isAfter(LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        if (upcoming && !isUpcoming) {
          return false;
        }
        if (!upcoming && isUpcoming) {
          return false;
        }
      }
      return true;
    }).map(e -> {
      long going = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.GOING);
      long interested = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.INTERESTED);
      return EventResponse.fromEntity(e, going, interested);
    }).sorted(Comparator.comparing(EventResponse::startAt)).toList();

    int start = (int) pageable.getOffset();
    int end = Math.min((start + pageable.getPageSize()), filtered.size());

    List<EventResponse> pageContent = new ArrayList<>();
    if (start < filtered.size()) {
      pageContent = filtered.subList(start, end);
    }

    return new PageImpl<>(pageContent, pageable, filtered.size());
  }

  public List<EventResponse> getMyUpcomingEvents(User user) {
    List<EventRsvp> rsvps = eventRsvpRepository.findByUserId(user.getId());
    return rsvps.stream().map(EventRsvp::getEvent).filter(e -> e.getStatus() == EventStatus.PUBLISHED && e.getStartAt().isAfter(LocalDateTime.now())).map(e -> {
      long going = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.GOING);
      long interested = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.INTERESTED);
      return EventResponse.fromEntity(e, going, interested);
    }).toList();
  }

  public String getMyRsvpStatus(Long eventId, User user) {
    return eventRsvpRepository.findByEventIdAndUserId(eventId, user.getId()).map(r -> r.getStatus().name()).orElse("");
  }

  public List<EventResponse> getCompanyEvents(Long companyId, boolean includeDrafts, User user) {
    Company hostCompany = companyService.getCompanyById(companyId);
    if (hostCompany.getStatus() == CompanyStatus.SUSPENDED) {
      boolean isOwnerOrAdmin = user != null && (user.getRole() == UserRole.ADMIN || companyMemberRepository.existsByCompanyIdAndUserIdAndRole(companyId, user.getId(), CompanyRole.OWNER));
      if (!isOwnerOrAdmin) {
        return List.of();
      }
    }

    List<Event> events;
    if (includeDrafts && user != null) {
      Optional<Company> myCompanyOpt = companyService.getMyCompany(user);
      if (myCompanyOpt.isPresent() && myCompanyOpt.get().getId().equals(companyId)) {
        events = eventRepository.findByHostCompanyId(companyId);
      } else {
        events = eventRepository.findByHostCompanyIdAndStatus(companyId, EventStatus.PUBLISHED);
      }
    } else {
      events = eventRepository.findByHostCompanyIdAndStatus(companyId, EventStatus.PUBLISHED);
    }

    return events.stream().map(e -> {
      long going = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.GOING);
      long interested = eventRsvpRepository.countByEventIdAndStatus(e.getId(), RsvpStatus.INTERESTED);
      return EventResponse.fromEntity(e, going, interested);
    }).toList();
  }

  private void validateEventOwner(Event event, User user) {
    if (user.getRole() == UserRole.ADMIN) {
      return;
    }
    if (!event.getOrganizer().getId().equals(user.getId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phải ban tổ chức sự kiện này");
    }
  }
}
