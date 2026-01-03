package com.hustlink.backend.features.networking.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import com.hustlink.backend.features.networking.service.ConnectionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/networking")
@RequiredArgsConstructor
public class ConnectionController {

  private final ConnectionService connectionService;

  @GetMapping("/connections")
  public List<Connection> getUserConnections(@RequestAttribute("authenticationUser") User user, @RequestParam(required = false) Status status, @RequestParam(required = false) Long userId) {
    if (userId != null) {
      return connectionService.getUserConnections(userId, status);
    }
    return connectionService.getUserConnections(user, status);
  }

  @PostMapping("/connections")
  public Connection sendConnectionRequest(@RequestAttribute("authenticationUser") User sender, @RequestParam Long recipientId) {
    return connectionService.sendConnectionRequest(sender, recipientId);
  }

  @PutMapping("/connections/{id}")
  public Connection acceptConnectionRequest(@RequestAttribute("authenticationUser") User recipient, @PathVariable Long id) {
    return connectionService.acceptConnectionRequest(recipient, id);
  }

  @DeleteMapping("/connections/{id}")
  public Connection rejectOrCancelConnection(@RequestAttribute("authenticationUser") User recipient, @PathVariable Long id) {
    return connectionService.rejectOrCancelConnection(recipient, id);
  }

  @PutMapping("/connections/{id}/seen")
  public Connection markConnectionAsSeen(@RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    return connectionService.markConnectionAsSeen(user, id);
  }

  @GetMapping("/suggestions")
  public List<User> getConnectionSuggestions(@RequestAttribute("authenticationUser") User user) {
    return connectionService.getConnectionSuggestions(user);
  }
}
