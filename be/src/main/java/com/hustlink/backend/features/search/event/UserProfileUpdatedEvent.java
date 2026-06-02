package com.hustlink.backend.features.search.event;

import com.hustlink.backend.features.authentication.model.User;
import org.springframework.context.ApplicationEvent;

public class UserProfileUpdatedEvent extends ApplicationEvent {
  private final User user;

  public UserProfileUpdatedEvent(Object source, User user) {
    super(source);
    this.user = user;
  }

  public User getUser() {
    return user;
  }
}
