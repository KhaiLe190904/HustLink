package com.hustlink.backend.features.authentication.controller;

import com.hustlink.backend.features.authentication.dto.AuthenticationRequestBody;
import com.hustlink.backend.features.authentication.dto.AuthenticationResponseBody;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.service.AuthenticationService;
import jakarta.mail.MessagingException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.UnsupportedEncodingException;
import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/authentication")
public class AuthenticationController {
  private final AuthenticationService authenticationService;

  @GetMapping("/users/me")
  public User getUser(@RequestAttribute("authenticationUser") User user) {
    return user;
  }

  @DeleteMapping("/delete")
  public String deleteUser(@RequestAttribute("authenticationUser") User user) {
    authenticationService.deleteUser(user.getId());
    return "User deleted successfully";
  }

  @PostMapping("/login")
  public AuthenticationResponseBody login(@Valid @RequestBody AuthenticationRequestBody loginRequestBody) {
    return authenticationService.login(loginRequestBody);
  }

  @PostMapping("/register")
  public AuthenticationResponseBody register(@Valid @RequestBody AuthenticationRequestBody registerRequestBody) throws MessagingException, UnsupportedEncodingException {
    return authenticationService.register(registerRequestBody);
  }

  @PutMapping("/validate-email-verification-token")
  public String verifyEmail(@RequestParam String tokenOTP, @RequestAttribute("authenticationUser") User user) {
    authenticationService.validateEmailVerificationToken(tokenOTP, user.getEmail());
    return "Email verified successfully.";
  }

  @GetMapping("/send-email-verification-token")
  public String sendEmailVerificationToken(@RequestAttribute("authenticationUser") User user) {
    authenticationService.sendEmailVerificationToken(user.getEmail());
    return "Email verification token sent successfully.";
  }

  @PutMapping("/send-password-reset-token")
  public String sendPasswordResetToken(@RequestParam String email) {
    authenticationService.sendPasswordResetToken(email);
    return "Password reset token sent successfully.";
  }

  @PutMapping("/reset-password")
  public String resetPassword(@RequestParam String newPassword, @RequestParam String token, @RequestParam String email) {
    authenticationService.resetPassword(email, newPassword, token);
    return "Password reset successfully.";
  }

  @PutMapping("/profile/{id}")
  public User updateUserProfile(@RequestAttribute("authenticationUser") User user, @PathVariable Long id, @RequestParam(required = false) String firstName, @RequestParam(required = false) String lastName, @RequestParam(required = false) String company, @RequestParam(required = false) String position, @RequestParam(required = false) String location, @RequestParam(required = false) String profilePicture, @RequestParam(required = false) String coverPicture, @RequestParam(required = false) String about) {
    if (!user.getId().equals(id)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User does not have permission to update user profile.");
    }
    return authenticationService.updateUserProfile(id, firstName, lastName, company, position, location, profilePicture, coverPicture, about);
  }

  @GetMapping("users")
  public List<User> getUsersWithoutAuthentication(@RequestAttribute("authenticationUser") User user) {
    return authenticationService.getUsersWithoutAuthentication(user);
  }

  @GetMapping("/users/{id}")
  public User getUserById(@PathVariable Long id) {
    return authenticationService.getUserById(id);
  }
}
