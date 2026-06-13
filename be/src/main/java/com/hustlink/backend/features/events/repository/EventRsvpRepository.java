package com.hustlink.backend.features.events.repository;

import com.hustlink.backend.features.events.model.EventRsvp;
import com.hustlink.backend.features.events.model.RsvpStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventRsvpRepository extends JpaRepository<EventRsvp, Long> {
  List<EventRsvp> findByEventId(Long eventId);

  List<EventRsvp> findByUserId(Long userId);

  Optional<EventRsvp> findByEventIdAndUserId(Long eventId, Long userId);

  boolean existsByEventIdAndUserId(Long eventId, Long userId);

  long countByEventIdAndStatus(Long eventId, RsvpStatus status);

  void deleteByEventId(Long eventId);
}
