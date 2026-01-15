package com.hustlink.backend.features.authentication.service;

import com.hustlink.backend.features.authentication.dto.AuthenticationRequestBody;
import com.hustlink.backend.features.authentication.dto.AuthenticationResponseBody;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.authentication.utils.EmailService;
import com.hustlink.backend.features.authentication.utils.Encoder;
import com.hustlink.backend.features.authentication.utils.JsonWebToken;
import io.jsonwebtoken.Claims;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
public class AuthenticationService {
  private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

  private final int durationInMinutes = 1;

  private final JsonWebToken jsonWebToken;
  private final Encoder encoder;
  private final UserRepository userRepository;
  private final EmailService emailService;
  private final RestTemplate restTemplate;

  @PersistenceContext
  private EntityManager entityManager;
  @Value("${oauth.google.client.id}")
  private String googleClientId;
  @Value("${oauth.google.client.secret}")
  private String googleClientSecret;
  @Value("${frontend.url}")
  private String frontendUrl;

  public AuthenticationService(JsonWebToken jsonWebToken, Encoder encoder, UserRepository userRepository, EmailService emailService, RestTemplate restTemplate) {
    this.jsonWebToken = jsonWebToken;
    this.encoder = encoder;
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.restTemplate = restTemplate;
  }

  public static String generateEmailVerificationTokenOTP() {
    SecureRandom random = new SecureRandom();
    StringBuilder token = new StringBuilder(5);
    for (int i = 0; i < 5; i++) {
      token.append(random.nextInt(10));
    }
    return token.toString();
  }

  private void validatePasswordPolicy(String password) {
    if (password == null || password.length() < 8) {
      throw new IllegalArgumentException("Password must be at least 8 characters long.");
    }

    // Check for at least one uppercase letter
    if (!password.matches(".*[A-Z].*")) {
      throw new IllegalArgumentException("Password must contain at least one uppercase letter (A-Z).");
    }

    // Check for at least one digit
    if (!password.matches(".*[0-9].*")) {
      throw new IllegalArgumentException("Password must contain at least one digit (0-9).");
    }

    // Check for at least one special character
    if (!password.matches(".*[^A-Za-z0-9].*")) {
      throw new IllegalArgumentException("Password must contain at least one special character (!@#$%^&*...).");
    }
  }

  public void sendEmailVerificationToken(String email) {
    Optional<User> user = userRepository.findByEmail(email);
    if (user.isPresent() && !user.get().getEmailVerified()) {
      String emailVerificationToken = generateEmailVerificationTokenOTP();
      String hashedToken = encoder.encode(emailVerificationToken);
      user.get().setEmailVerificationToken(hashedToken);
      user.get().setEmailVerificationTokenExpiryDate(LocalDateTime.now().plusMinutes(durationInMinutes));
      userRepository.save(user.get());
      String subject = "Email Verification";
      String body = String.format(
              """
                      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 480px;">
                        <h2 style="margin-bottom: 8px;">Verify your email for HustLink</h2>
                        <p style="margin: 0 0 12px 0;">
                          Only one step to take full advantage of HustLink.
                        </p>
                        <p style="margin: 0 0 8px 0;">
                          Enter this code to verify your email:
                        </p>
                        <div
                          style="
                            display: inline-block;
                            padding: 10px 16px;
                            margin: 8px 0 14px 0;
                            border-radius: 6px;
                            border: 1px solid #d0d7de;
                            background-color: #f6f8fa;
                            font-size: 20px;
                            letter-spacing: 4px;
                            font-weight: 700;
                            font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                          ">
                          %s
                        </div>
                        <p style="margin: 0; color: #57606a; font-size: 14px;">
                          This code will expire in <strong>%s minute(s)</strong>.
                        </p>
                      </div>
                      """, emailVerificationToken, durationInMinutes);
      try {
        String messageId = emailService.sendEmail(email, subject, body);
        user.get().setEmailVerificationProviderMessageId(messageId);
        user.get().setEmailVerificationDeliveryStatus("pending");
        userRepository.save(user.get());
      } catch (Exception e) {
        logger.info("Error while sending email: {}", e.getMessage());
      }
    } else {
      throw new IllegalArgumentException("Email verification token failed, or email is already verified.");
    }
  }

  public void validateEmailVerificationToken(String tokenOTP, String email) {
    Optional<User> user = userRepository.findByEmail(email);
    if (user.isPresent() && encoder.matches(tokenOTP, user.get().getEmailVerificationToken()) && !user.get().getEmailVerificationTokenExpiryDate().isBefore(LocalDateTime.now())) {
      user.get().setEmailVerified(true);
      user.get().setEmailVerificationToken(null);
      user.get().setEmailVerificationTokenExpiryDate(null);
      userRepository.save(user.get());
    } else
      if (user.isPresent() && encoder.matches(tokenOTP, user.get().getEmailVerificationToken()) && user.get().getEmailVerificationTokenExpiryDate().isBefore(LocalDateTime.now())) {
        throw new IllegalArgumentException("Email verification token expired.");
      } else {
        throw new IllegalArgumentException("Email verification token failed.");
      }
  }

  public User getUser(String email) {
    return userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("User not found"));
  }

  public AuthenticationResponseBody googleLoginOrSignup(String code, String page) {
    String tokenEndpoint = "https://oauth2.googleapis.com/token";
    String redirectUri = frontendUrl + "/authentication/" + page;
    MultiValueMap<String, String> body = new LinkedMultiValueMap<>();

    body.add("code", code);
    body.add("client_id", googleClientId);
    body.add("client_secret", googleClientSecret);
    body.add("redirect_uri", redirectUri);
    body.add("grant_type", "authorization_code");

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
    HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

    ResponseEntity<Map<String, Object>> response = restTemplate.exchange(tokenEndpoint, HttpMethod.POST, request, new ParameterizedTypeReference<>() {
    });

    if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
      Map<String, Object> responseBody = response.getBody();
      String idToken = (String) responseBody.get("id_token");

      Claims claims = jsonWebToken.getClaimsFromGoogleOauthIdToken(idToken);
      String email = claims.get("email", String.class);
      User user = userRepository.findByEmail(email).orElse(null);

      if (user == null) {
        Boolean emailVerified = claims.get("email_verified", Boolean.class);
        String firstName = claims.get("given_name", String.class);
        String lastName = claims.get("family_name", String.class);
        User newUser = new User(email, null);
        newUser.setEmailVerified(emailVerified);
        newUser.setFirstName(firstName);
        newUser.setLastName(lastName);
        userRepository.save(newUser);
      }

      String token = jsonWebToken.generateToken(email);
      return new AuthenticationResponseBody(token, "Google authentication succeeded.");
    } else {
      throw new IllegalArgumentException("Failed to exchange code for ID token.");
    }
  }

  public AuthenticationResponseBody register(AuthenticationRequestBody registerRequestBody) {
    validatePasswordPolicy(registerRequestBody.getPassword());
    // Check if email was previously bounced
    Optional<User> existingUser = userRepository.findByEmail(registerRequestBody.getEmail());
    if (existingUser.isPresent()) {
      User existing = existingUser.get();
      if (!existing.getEmailVerified() && "bounced".equals(existing.getEmailVerificationDeliveryStatus())) {
        throw new IllegalArgumentException("This email was previously bounced. Please use a different email.");
      }
      if (existing.getEmailVerified()) {
        throw new IllegalArgumentException("This email has already been registered. Please login instead.");
      }
      // If email exists, not verified, and delivery status is "delivered", just resend OTP
      if (!existing.getEmailVerified() && "delivered".equals(existing.getEmailVerificationDeliveryStatus())) {
        // Update password in case user wants to change it
        validatePasswordPolicy(registerRequestBody.getPassword());
        existing.setPassword(encoder.encode(registerRequestBody.getPassword()));
        // Generate new OTP
        String emailVerificationToken = generateEmailVerificationTokenOTP();
        String hashedToken = encoder.encode(emailVerificationToken);
        existing.setEmailVerificationToken(hashedToken);
        existing.setEmailVerificationTokenExpiryDate(LocalDateTime.now().plusMinutes(durationInMinutes));

        String subject = "Email Verification";
        String body = String.format(
                """
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 480px;">
                          <h2 style="margin-bottom: 8px;">Welcome to HustLink</h2>
                          <p style="margin: 0 0 12px 0;">
                            You're almost done creating your account. Please verify your email to continue.
                          </p>
                          <p style="margin: 0 0 8px 0;">
                            Enter this code to verify your email:
                          </p>
                          <div
                            style="
                              display: inline-block;
                              padding: 10px 16px;
                              margin: 8px 0 14px 0;
                              border-radius: 6px;
                              border: 1px solid #d0d7de;
                              background-color: #f6f8fa;
                              font-size: 20px;
                              letter-spacing: 4px;
                              font-weight: 700;
                              font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                            ">
                            %s
                          </div>
                          <p style="margin: 0; color: #57606a; font-size: 14px;">
                            This code will expire in <strong>%s minute(s)</strong>.
                          </p>
                        </div>
                        """, emailVerificationToken, durationInMinutes);
        try {
          String messageId = emailService.sendEmail(registerRequestBody.getEmail(), subject, body);
          existing.setEmailVerificationProviderMessageId(messageId);
          existing.setEmailVerificationDeliveryStatus("pending");
          userRepository.save(existing);
        } catch (Exception e) {
          logger.info("Error while sending email: {}", e.getMessage());
        }
        String authToken = jsonWebToken.generateToken(registerRequestBody.getEmail());
        return new AuthenticationResponseBody(authToken, "Verification email resent successfully.");
      }
    }

    User user = userRepository.save(new User(registerRequestBody.getEmail(), encoder.encode(registerRequestBody.getPassword())));

    String emailVerificationToken = generateEmailVerificationTokenOTP();
    String hashedToken = encoder.encode(emailVerificationToken);
    user.setEmailVerificationToken(hashedToken);
    user.setEmailVerificationTokenExpiryDate(LocalDateTime.now().plusMinutes(durationInMinutes));

    String subject = "Email Verification";
    String body = String.format(
            """
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 480px;">
                      <h2 style="margin-bottom: 8px;">Welcome to HustLink</h2>
                      <p style="margin: 0 0 12px 0;">
                        You're almost done creating your account. Please verify your email to continue.
                      </p>
                      <p style="margin: 0 0 8px 0;">
                        Enter this code to verify your email:
                      </p>
                      <div
                        style="
                          display: inline-block;
                          padding: 10px 16px;
                          margin: 8px 0 14px 0;
                          border-radius: 6px;
                          border: 1px solid #d0d7de;
                          background-color: #f6f8fa;
                          font-size: 20px;
                          letter-spacing: 4px;
                          font-weight: 700;
                          font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                        ">
                        %s
                      </div>
                      <p style="margin: 0; color: #57606a; font-size: 14px;">
                        This code will expire in <strong>%s minute(s)</strong>.
                      </p>
                    </div>
                    """, emailVerificationToken, durationInMinutes);
    try {
      String messageId = emailService.sendEmail(registerRequestBody.getEmail(), subject, body);
      user.setEmailVerificationProviderMessageId(messageId);
      user.setEmailVerificationDeliveryStatus("pending");
      userRepository.save(user);
    } catch (Exception e) {
      logger.info("Error while sending email: {}", e.getMessage());
    }
    String authToken = jsonWebToken.generateToken(registerRequestBody.getEmail());
    return new AuthenticationResponseBody(authToken, "User registered successfully.");
  }

  public AuthenticationResponseBody login(AuthenticationRequestBody loginRequestBody) {
    User user = userRepository.findByEmail(loginRequestBody.getEmail()).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (!encoder.matches(loginRequestBody.getPassword(), user.getPassword())) {
      throw new IllegalArgumentException("Wrong password");
    }
    String token = jsonWebToken.generateToken(loginRequestBody.getEmail());
    return new AuthenticationResponseBody(token, "User successfully logged in");
  }

  public void sendPasswordResetToken(String email) {
    Optional<User> user = userRepository.findByEmail(email);
    if (user.isPresent()) {
      String passwordResetToken = generateEmailVerificationTokenOTP();
      String hashedToken = encoder.encode(passwordResetToken);
      user.get().setPasswordResetToken(hashedToken);
      user.get().setPasswordResetTokenExpiryDate(LocalDateTime.now().plusMinutes(durationInMinutes));
      userRepository.save(user.get());
      String subject = "Password Reset";
      String body = String.format(
              """
                      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 480px;">
                        <h2 style="margin-bottom: 8px;">Reset your HustLink password</h2>
                        <p style="margin: 0 0 12px 0;">
                          You requested a password reset. If this wasn't you, you can safely ignore this email.
                        </p>
                        <p style="margin: 0 0 8px 0;">
                          Enter this code to reset your password:
                        </p>
                        <div
                          style="
                            display: inline-block;
                            padding: 10px 16px;
                            margin: 8px 0 14px 0;
                            border-radius: 6px;
                            border: 1px solid #d0d7de;
                            background-color: #f6f8fa;
                            font-size: 20px;
                            letter-spacing: 4px;
                            font-weight: 700;
                            font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                          ">
                          %s
                        </div>
                        <p style="margin: 0; color: #57606a; font-size: 14px;">
                          This code will expire in <strong>%s minute(s)</strong>.
                        </p>
                      </div>
                      """, passwordResetToken, durationInMinutes);
      try {
        emailService.sendEmail(email, subject, body);
      } catch (Exception e) {
        logger.info("Error while sending email: {}", e.getMessage());
      }
    } else {
      throw new IllegalArgumentException("User not found.");
    }
  }

  public void resetPassword(String email, String newPassword, String token) {
    validatePasswordPolicy(newPassword);
    Optional<User> user = userRepository.findByEmail(email);
    if (user.isPresent() && encoder.matches(token, user.get().getPasswordResetToken()) && !user.get().getPasswordResetTokenExpiryDate().isBefore(LocalDateTime.now())) {
      user.get().setPasswordResetToken(null);
      user.get().setPasswordResetTokenExpiryDate(null);
      user.get().setPassword(encoder.encode(newPassword));
      userRepository.save(user.get());
    } else
      if (user.isPresent() && encoder.matches(token, user.get().getPasswordResetToken()) && user.get().getPasswordResetTokenExpiryDate().isBefore(LocalDateTime.now())) {
        throw new IllegalArgumentException("Password reset token expired.");
      } else {
        throw new IllegalArgumentException("Password reset token failed.");
      }
  }

  public User updateUserProfile(Long userId, String firstName, String lastName, String company, String position, String location, String profilePicture, String coverPicture, String about) {
    User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
    if (firstName != null && !firstName.isEmpty())
      user.setFirstName(firstName);
    if (lastName != null && !lastName.isEmpty())
      user.setLastName(lastName);
    if (company != null && !company.isEmpty())
      user.setCompany(company);
    if (position != null && !position.isEmpty())
      user.setPosition(position);
    if (location != null && !location.isEmpty())
      user.setLocation(location);
    if (profilePicture != null)
      user.setProfilePicture(profilePicture);
    if (coverPicture != null)
      user.setCoverPicture(coverPicture);
    if (about != null)
      user.setAbout(about);
    return userRepository.save(user);
  }

  @Transactional
  public void deleteUser(Long id) {
    User user = entityManager.find(User.class, id);
    if (user != null) {
      entityManager.createNativeQuery("DELETE FROM post_like WHERE user_id = :id").setParameter("id", id).executeUpdate();
      userRepository.deleteById(id);
    }
  }

  public List<User> getUsersWithoutAuthentication(User user) {
    return userRepository.findAllByIdNot(user.getId());
  }

  public User getUserById(Long receiverId) {
    return userRepository.findById(receiverId).orElseThrow(() -> new IllegalArgumentException("User not found"));
  }
}
