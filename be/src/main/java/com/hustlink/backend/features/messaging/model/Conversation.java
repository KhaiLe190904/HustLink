package com.hustlink.backend.features.messaging.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity(name = "conversations")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Conversation {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  private User author;

  @ManyToOne(optional = false)
  private User recipient;

  @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<Message> messages = new ArrayList<>();

  public Conversation(User author, User recipient) {
    this.author = author;
    this.recipient = recipient;
  }
}
