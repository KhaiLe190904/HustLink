package com.hustlink.backend.features.authentication.utils;


import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
  private final Resend resend;

  public EmailService(@Value("${resend.api.key}") String apiKey) {
    this.resend = new Resend(apiKey);
  }

  public String sendEmail(String email, String subject, String content) {
    CreateEmailOptions params = CreateEmailOptions.builder().from("HustLink <no-reply@lekhai.id.vn>").to(email).subject(subject).html(content).build();

    try {
      CreateEmailResponse response = resend.emails().send(params);
      return response.getId();
    } catch (ResendException e) {
      throw new RuntimeException("Failed to send email via Resend", e);
    }
  }
}
