package com.hustlink.backend.features.authentication.utils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class EncoderTest {
  private final Encoder encoder = new Encoder();

  @Test
  void encodesAndMatchesBcryptHashes() {
    String firstHash = encoder.encode("StrongPassword1!");
    String secondHash = encoder.encode("StrongPassword1!");

    assertTrue(firstHash.startsWith("$2"));
    assertNotEquals(firstHash, secondHash);
    assertTrue(encoder.matches("StrongPassword1!", firstHash));
    assertFalse(encoder.matches("WrongPassword1!", firstHash));
    assertFalse(encoder.needsUpgrade(firstHash));
  }

  @Test
  void acceptsLegacySha256HashForLoginMigration() throws Exception {
    String password = "LegacyPassword1!";
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    String legacyHash = Base64.getEncoder().encodeToString(
            digest.digest(password.getBytes(StandardCharsets.UTF_8)));

    assertTrue(encoder.matches(password, legacyHash));
    assertFalse(encoder.matches("WrongPassword1!", legacyHash));
    assertTrue(encoder.needsUpgrade(legacyHash));
  }
}
