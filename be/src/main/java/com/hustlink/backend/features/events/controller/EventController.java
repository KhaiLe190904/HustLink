package com.hustlink.backend.features.events.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.events.dto.*;
import com.hustlink.backend.features.events.service.EventService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class EventController {
  private final EventService eventService;

  @PostMapping("/events")
  public ResponseEntity<EventResponse> createEvent(
                                                   @Valid @RequestBody EventRequest request, @RequestAttribute("authenticationUser") User user) {
    EventResponse event = eventService.createEvent(request, user);
    return ResponseEntity.ok(event);
  }

  @PatchMapping("/events/{id}")
  public ResponseEntity<EventResponse> updateEvent(
                                                   @PathVariable Long id, @Valid @RequestBody EventRequest request, @RequestAttribute("authenticationUser") User user) {
    EventResponse event = eventService.updateEvent(id, request, user);
    return ResponseEntity.ok(event);
  }

  @PatchMapping("/events/{id}/publish")
  public ResponseEntity<EventResponse> publishEvent(
                                                    @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    EventResponse event = eventService.publishEvent(id, user);
    return ResponseEntity.ok(event);
  }

  @PatchMapping("/events/{id}/cancel")
  public ResponseEntity<EventResponse> cancelEvent(
                                                   @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    EventResponse event = eventService.cancelEvent(id, user);
    return ResponseEntity.ok(event);
  }

  @DeleteMapping("/events/{id}")
  public ResponseEntity<Void> deleteEvent(
                                          @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    eventService.deleteEvent(id, user);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/events")
  public ResponseEntity<Page<EventResponse>> searchEvents(
                                                          @RequestParam(required = false) String q, @RequestParam(required = false) String type, @RequestParam(required = false) String city, @RequestParam(required = false) Boolean upcoming, @PageableDefault(size = 6) Pageable pageable) {
    Page<EventResponse> events = eventService.searchEvents(q, type, city, upcoming, pageable);
    return ResponseEntity.ok(events);
  }

  @GetMapping("/events/{id}")
  public ResponseEntity<EventResponse> getEventDetail(@PathVariable Long id) {
    EventResponse event = eventService.getEventDetail(id);
    return ResponseEntity.ok(event);
  }

  @PostMapping("/events/{id}/rsvp")
  public ResponseEntity<Void> rsvpEvent(
                                        @PathVariable Long id, @RequestBody Map<String, String> body, @RequestAttribute("authenticationUser") User user) {
    String status = body.get("status");
    eventService.rsvpEvent(id, status, user);
    return ResponseEntity.ok().build();
  }

  @DeleteMapping("/events/{id}/rsvp")
  public ResponseEntity<Void> cancelRsvp(
                                         @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    eventService.cancelRsvp(id, user);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/events/my/upcoming")
  public ResponseEntity<List<EventResponse>> getMyUpcomingEvents(
                                                                 @RequestAttribute("authenticationUser") User user) {
    List<EventResponse> events = eventService.getMyUpcomingEvents(user);
    return ResponseEntity.ok(events);
  }

  @GetMapping("/events/{id}/rsvp-status")
  public ResponseEntity<Map<String, String>> getMyRsvpStatus(
                                                             @PathVariable Long id, @RequestAttribute("authenticationUser") User user) {
    String status = eventService.getMyRsvpStatus(id, user);
    return ResponseEntity.ok(Map.of("status", status));
  }

  @GetMapping("/companies/{companyId}/events")
  public ResponseEntity<List<EventResponse>> getCompanyEvents(
                                                              @PathVariable Long companyId, @RequestParam(required = false, defaultValue = "false") boolean includeDrafts, @RequestAttribute(value = "authenticationUser", required = false) User user) {
    List<EventResponse> events = eventService.getCompanyEvents(companyId, includeDrafts, user);
    return ResponseEntity.ok(events);
  }
}
