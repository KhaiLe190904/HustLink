package com.hustlink.backend.features.authentication.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class Encoder {
  private static final int BCRYPT_STRENGTH = 12;
  private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(BCRYPT_STRENGTH);

  public String encode(String rawString) {
    return bcrypt.encode(rawString);
  }

  public boolean matches(String rawString, String encodedString) {
    if (rawString == null || encodedString == null) {
      return false;
    }
    if (isBcryptHash(encodedString)) {
      return bcrypt.matches(rawString, encodedString);
    }

    byte[] legacyHash = legacySha256(rawString).getBytes(StandardCharsets.UTF_8);
    byte[] storedHash = encodedString.getBytes(StandardCharsets.UTF_8);
    return MessageDigest.isEqual(legacyHash, storedHash);
  }

  public boolean needsUpgrade(String encodedString) {
    return !isBcryptHash(encodedString) || bcrypt.upgradeEncoding(encodedString);
  }

  private boolean isBcryptHash(String encodedString) {
    return encodedString != null && (encodedString.startsWith("$2a$") || encodedString.startsWith("$2b$") || encodedString.startsWith("$2y$"));
  }

  private String legacySha256(String rawString) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return Base64.getEncoder().encodeToString(
              digest.digest(rawString.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
