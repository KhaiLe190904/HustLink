package com.hustlink.backend.features.events.repository;

import com.hustlink.backend.features.events.model.Event;
import com.hustlink.backend.features.events.model.EventStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
  List<Event> findByStatus(EventStatus status);

  List<Event> findByOrganizerId(Long organizerId);

  List<Event> findByHostCompanyIdAndStatus(Long companyId, EventStatus status);

  List<Event> findByHostCompanyId(Long hostCompanyId);
}
