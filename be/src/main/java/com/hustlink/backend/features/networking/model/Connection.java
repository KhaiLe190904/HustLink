package com.hustlink.backend.features.networking.model;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity(name = "connections")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Connection {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "author_id", nullable = false)
  private User author;

  @ManyToOne
  @JoinColumn(name = "recipient_id", nullable = false)
  private User recipient;

  @NotNull
  private Status status = Status.PENDING;

  private Boolean seen = false;

  @CreationTimestamp
  private LocalDateTime connectionDate;

  public Connection(User author, User recipient) {
    this.author = author;
    this.recipient = recipient;
  }
}
