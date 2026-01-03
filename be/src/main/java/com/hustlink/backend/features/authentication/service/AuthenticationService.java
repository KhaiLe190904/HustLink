package com.hustlink.backend.features.authentication.service;

import com.hustlink.backend.features.authentication.dto.AuthenticationRequestBody;
import com.hustlink.backend.features.authentication.dto.AuthenticationResponseBody;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.authentication.utils.EmailService;
import com.hustlink.backend.features.authentication.utils.Encoder;
import com.hustlink.backend.features.authentication.utils.JsonWebToken;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
public class AuthenticationService {
  private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

  private final int durationInMinutes = 1;

  private final JsonWebToken jsonWebToken;
  private final Encoder encoder;
  private final UserRepository userRepository;
  private final EmailService emailService;

  @PersistenceContext
  private EntityManager entityManager;

  public static String generateEmailVerificationTokenOTP() {
    SecureRandom random = new SecureRandom();
    StringBuilder token = new StringBuilder(5);
    for (int i = 0; i < 5; i++) {
      token.append(random.nextInt(10));
    }
    return token.toString();
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
              "Only one step to take full advantage of HustLink.\n\n" + "Enter this code to verify your email: " + "%s\n\n" + "The code will expire in " + "%s" + " minutes.", emailVerificationToken, durationInMinutes);
      try {
        emailService.sendEmail(email, subject, body);
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

  public AuthenticationResponseBody register(AuthenticationRequestBody registerRequestBody) {
    User user = userRepository.save(new User(registerRequestBody.getEmail(), encoder.encode(registerRequestBody.getPassword())));

    String emailVerificationToken = generateEmailVerificationTokenOTP();
    String hashedToken = encoder.encode(emailVerificationToken);
    user.setEmailVerificationToken(hashedToken);
    user.setEmailVerificationTokenExpiryDate(LocalDateTime.now().plusMinutes(durationInMinutes));

    userRepository.save(user);

    String subject = "Email Verification";
    String body = String.format("""
            Only one step to take full advantage of HustLink.

            Enter this code to verify your email: %s. The code will expire in %s minutes.""", emailVerificationToken, durationInMinutes);
    try {
      emailService.sendEmail(registerRequestBody.getEmail(), subject, body);
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
      String body = String.format("""
              You requested a password reset.

              Enter this code to reset your password: %s. The code will expire in %s minutes.""", passwordResetToken, durationInMinutes);
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
