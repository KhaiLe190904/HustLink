package com.hustlink.backend.features.authentication.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AuthenticationResponseBody {
  private String token;
  private String message;
}
