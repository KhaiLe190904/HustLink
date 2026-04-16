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
@Table(indexes = {@Index(name = "idx_messages_conversation_id", columnList = "conversation_id"), @Index(name = "idx_messages_creation_at", columnList = "creationAt DESC"), @Index(name = "idx_messages_conversation_creation", columnList = "conversation_id, creationAt DESC")
})
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

  private Long attachmentObjectId;

  private String attachmentKind;

  private String attachmentFileName;

  private String attachmentContentType;

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

  public Message(
                 User sender, User receiver, Conversation conversation, String content, Long attachmentObjectId, String attachmentKind, String attachmentFileName, String attachmentContentType) {
    this.sender = sender;
    this.receiver = receiver;
    this.conversation = conversation;
    this.content = content;
    this.attachmentObjectId = attachmentObjectId;
    this.attachmentKind = attachmentKind;
    this.attachmentFileName = attachmentFileName;
    this.attachmentContentType = attachmentContentType;
  }
}
