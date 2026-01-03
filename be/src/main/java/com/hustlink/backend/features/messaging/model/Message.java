package com.hustlink.backend.features.messaging.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity(name = "messages")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Message {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  private User sender;

  @ManyToOne(optional = false)
  private User receiver;

  @JsonIgnore
  @ManyToOne(optional = false)
  private Conversation conversation;

  @Column(columnDefinition = "NVARCHAR(MAX)")
  private String content;

  @JsonProperty("isRead")
  private boolean isRead;

  @CreationTimestamp
  private LocalDateTime creationAt;

  public Message(User sender, User receiver, Conversation conversation, String content) {
    this.sender = sender;
    this.receiver = receiver;
    this.conversation = conversation;
    this.content = content;
  }
}
